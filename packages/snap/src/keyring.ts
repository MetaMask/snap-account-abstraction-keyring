/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable camelcase */
import {
  addHexPrefix,
  Address,
  isValidPrivate,
  stripHexPrefix,
  toChecksumAddress,
} from '@ethereumjs/util';
import type { DeleGator } from '@metamask/delegator-sdk';
import type { MultiSigDeleGatorDeployParams } from '@metamask/delegator-sdk/dist/types/types';
import type {
  EthBaseTransaction,
  EthBaseUserOperation,
  EthUserOperation,
  EthUserOperationPatch,
  Keyring,
  KeyringAccount,
  KeyringRequest,
  SubmitRequestResponse,
} from '@metamask/keyring-api';
import { emitSnapKeyringEvent, EthMethod } from '@metamask/keyring-api';
import { KeyringEvent } from '@metamask/keyring-api/dist/events';
import { hexToBytes, type Json, type JsonRpcRequest } from '@metamask/utils';
import { Buffer } from 'buffer';
import { BigNumber, ethers } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import { v4 as uuid } from 'uuid';

import { DEFAULT_AA_FACTORIES } from './constants/aa-factories';
import { CHAIN_IDS } from './constants/chain-ids';
import {
  DUMMY_SIGNATURE,
  getDummyPaymasterAndData,
} from './constants/dummy-values';
import { DEFAULT_ENTRYPOINTS } from './constants/entrypoints';
import { logger } from './logger';
import { InternalMethod } from './permissions';
import { saveState } from './stateManagement';
import {
  EntryPoint__factory,
  SimpleAccount__factory,
  SimpleAccountFactory__factory,
  VerifyingPaymaster__factory,
} from './types';
import { getUserOperationHash } from './utils/ecdsa';
import { getSigner, provider } from './utils/ethers';
import {
  isEvmChain,
  isUniqueAddress,
  runSensitive,
  throwError,
} from './utils/util';
import { deleGatorSdk } from '../../../../snap-delegator-accounts/packages/snap/src/delegator';

const unsupportedAAMethods = [
  EthMethod.SignTransaction,
  EthMethod.Sign,
  EthMethod.PersonalSign,
  EthMethod.SignTypedDataV1,
  EthMethod.SignTypedDataV3,
  EthMethod.SignTypedDataV4,
];

export type ChainConfig = {
  simpleAccountFactory?: string;
  entryPoint?: string;
  bundlerUrl?: string;
  customVerifyingPaymasterPK?: string;
  customVerifyingPaymasterAddress?: string;
};

export type KeyringState = {
  wallets: Record<string, Wallet>;
  pendingRequests: Record<string, KeyringRequest>;
  config: Record<number, ChainConfig>;
};

export type Wallet = {
  account: KeyringAccount;
  admin: string;
  privateKey: string;
  chains: Record<string, boolean>;
  salt: string;
  initCode: string;
};

export class AccountAbstractionKeyring implements Keyring {
  #state: KeyringState;

  constructor(state: KeyringState) {
    this.#state = state;
  }

  async setConfig(config: ChainConfig): Promise<ChainConfig> {
    const { chainId } = await provider.getNetwork();
    if (
      config.simpleAccountFactory &&
      !ethers.utils.isAddress(config.simpleAccountFactory)
    ) {
      throwError(
        `[Snap] Invalid Simple Account Factory Address: ${config.simpleAccountFactory}`,
      );
    }
    if (config.entryPoint && !ethers.utils.isAddress(config.entryPoint)) {
      throwError(`[Snap] Invalid EntryPoint Address: ${config.entryPoint}`);
    }
    if (
      config.customVerifyingPaymasterAddress &&
      !ethers.utils.isAddress(config.customVerifyingPaymasterAddress)
    ) {
      throwError(
        `[Snap] Invalid Verifying Paymaster Address: ${config.customVerifyingPaymasterAddress}`,
      );
    }
    const bundlerUrlRegex =
      /^(https?:\/\/)?[\w\\.-]+(:\d{2,6})?(\/[\\/\w \\.-]*)?$/u;
    if (config.bundlerUrl && !bundlerUrlRegex.test(config.bundlerUrl)) {
      throwError(`[Snap] Invalid Bundler URL: ${config.bundlerUrl}`);
    }
    if (config.customVerifyingPaymasterPK) {
      try {
        // eslint-disable-next-line no-new -- doing this to validate the pk
        new ethers.Wallet(config.customVerifyingPaymasterPK);
      } catch (error) {
        throwError(
          `[Snap] Invalid Verifying Paymaster Private Key: ${
            (error as Error).message
          }`,
        );
      }
    }
    this.#state.config[Number(chainId)] = {
      ...this.#state.config[Number(chainId)],
      ...config,
    };

    await this.#saveState();
    return this.#state.config[Number(chainId)]!;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    return Object.values(this.#state.wallets).map((wallet) => wallet.account);
  }

  async getAccount(id: string): Promise<KeyringAccount> {
    return (
      this.#state.wallets[id]?.account ??
      throwError(`Account '${id}' not found`)
    );
  }

  async createAccount(
    options: Record<string, Json> = {},
  ): Promise<KeyringAccount> {
    const { deploy } = options as { deploy: boolean };
    if (!options.privateKey) {
      throwError(`[Snap] Private Key is required`);
    }
    const { privateKey, address: admin } = this.#getKeyPair(
      options?.privateKey as string | undefined,
    );
    if (!isUniqueAddress(admin, Object.values(this.#state.wallets))) {
      throwError(`Account address already in use: ${admin}`);
    }
    delete options.privateKey;

    const { chainId } = await provider.getNetwork();

    // Create counterfactual DeleGator
    let deleGator: DeleGator, creationCode: ethers.BytesLike, initCode: string;
    const deployParams: MultiSigDeleGatorDeployParams = {
      owners: [admin],
      threshold: 1,
    };

    const random = BigNumber.from(ethers.utils.randomBytes(32)).toBigInt();
    const defaultSalt = ethers.utils.defaultAbiCoder.encode(
      ['uint256'],
      [random],
    );
    const salt = typeof options.salt === 'string' ? options.salt : defaultSalt;

    try {
      const result = deleGatorSdk.createCounterfactualMultiSigDeleGator(
        deployParams,
        salt,
      );
      deleGator = result.deleGator;
      creationCode = result.deleGatorProxyCreationcode;
      initCode = deleGatorSdk.getMultiSigDeleGatorDeployBytecode(
        deployParams,
        salt,
      );
      logger.info(
        '[Snap] Deployed Counterfactual MultiSigDeleGator successfully',
      );
    } catch (error) {
      logger.error(
        `Error to deploy Counterfactual MultiSigDeleGator: ${
          (error as Error).message
        }`,
      );
      throwError(
        `Error to deploy Counterfactual MultiSigDeleGator: ${
          (error as Error).message
        }`,
      );
    }

    if (deploy) {
      // Deploy counterfactual MultiSigDeleGator on chain
      try {
        const signer = new ethers.Wallet(privateKey, provider);
        await deleGatorSdk.deployCounterfactualDeleGator(signer, creationCode);
        logger.info('[Snap] Deployed MultiSigDeleGator successfully');
      } catch (error) {
        logger.error(
          `Error to deploy MultiSigDeleGator: ${(error as Error).message}`,
        );
        throwError(
          `Error to deploy MultiSigDeleGator: ${(error as Error).message}`,
        );
      }
    }

    try {
      const account: KeyringAccount = {
        id: uuid(),
        options,
        // Use the address of the 4337 DeleGator
        address: deleGator.address,
        methods: [
          EthMethod.PersonalSign,
          EthMethod.Sign,
          EthMethod.SignTransaction,
          EthMethod.SignTypedDataV1,
          EthMethod.SignTypedDataV3,
          EthMethod.SignTypedDataV4,
        ],
        type: 'eip155:erc4337',
      };
      await this.#emitEvent(KeyringEvent.AccountCreated, { account });
      this.#state.wallets[account.id] = {
        account,
        admin,
        privateKey,
        chains: { [chainId.toString()]: false },
        salt,
        initCode,
      };
      await this.#saveState();
      return account;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  async filterAccountChains(_id: string, chains: string[]): Promise<string[]> {
    // The `id` argument is not used because all accounts created by this snap
    // are expected to be compatible with any EVM chain.
    return chains.filter((chain) => isEvmChain(chain));
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    const wallet =
      this.#state.wallets[account.id] ??
      throwError(`Account '${account.id}' not found`);

    if (
      unsupportedAAMethods.some((method) => account.methods.includes(method))
    ) {
      throwError(`[Snap] Account does not implement EIP-1271`);
    }

    const newAccount: KeyringAccount = {
      ...wallet.account,
      ...account,
      // Restore read-only properties.
      address: wallet.account.address,
    };

    try {
      await this.#emitEvent(KeyringEvent.AccountUpdated, {
        account: newAccount,
      });
      wallet.account = newAccount;
      await this.#saveState();
    } catch (error) {
      throwError((error as Error).message);
    }
  }

  async deleteAccount(id: string): Promise<void> {
    try {
      await this.#emitEvent(KeyringEvent.AccountDeleted, { id });
      delete this.#state.wallets[id];
      await this.#saveState();
    } catch (error) {
      throwError((error as Error).message);
    }
  }

  async listRequests(): Promise<KeyringRequest[]> {
    return Object.values(this.#state.pendingRequests);
  }

  async getRequest(id: string): Promise<KeyringRequest> {
    return (
      this.#state.pendingRequests[id] ?? throwError(`Request '${id}' not found`)
    );
  }

  async submitRequest(request: KeyringRequest): Promise<SubmitRequestResponse> {
    return this.#syncSubmitRequest(request);
  }

  async approveRequest(id: string): Promise<void> {
    const { account, request } =
      this.#state.pendingRequests[id] ??
      throwError(`Request '${id}' not found`);

    const result = await this.#handleSigningRequest({
      account: this.#getWalletById(account).account,
      method: request.method,
      params: request.params ?? [],
    });

    await this.#removePendingRequest(id);
    await this.#emitEvent(KeyringEvent.RequestApproved, { id, result });
  }

  async rejectRequest(id: string): Promise<void> {
    if (this.#state.pendingRequests[id] === undefined) {
      throw new Error(`Request '${id}' not found`);
    }

    await this.#removePendingRequest(id);
    await this.#emitEvent(KeyringEvent.RequestRejected, { id });
  }

  async #removePendingRequest(id: string): Promise<void> {
    delete this.#state.pendingRequests[id];
    await this.#saveState();
  }

  async #syncSubmitRequest(
    request: KeyringRequest,
  ): Promise<SubmitRequestResponse> {
    const { method, params = [] } = request.request as JsonRpcRequest;

    if (method === InternalMethod.SetConfig) {
      return {
        pending: false,
        result: await this.setConfig((params as [ChainConfig])[0]),
      };
    }

    const signature = await this.#handleSigningRequest({
      account: this.#getWalletById(request.account).account,
      method,
      params,
    });
    return {
      pending: false,
      result: signature,
    };
  }

  #getWalletById(accountId: string): Wallet {
    const wallet = this.#state.wallets[accountId];
    if (!wallet) {
      throwError(`Account '${accountId}' not found`);
    }
    return wallet;
  }

  #getWalletByAddress(address: string): Wallet {
    const match = Object.values(this.#state.wallets).find(
      (wallet) =>
        wallet.account.address.toLowerCase() === address.toLowerCase(),
    );

    return match ?? throwError(`Account '${address}' not found`);
  }

  #getKeyPair(privateKey?: string): {
    privateKey: string;
    address: string;
  } {
    const privateKeyBuffer: Buffer = runSensitive(
      () =>
        privateKey
          ? Buffer.from(hexToBytes(addHexPrefix(privateKey)))
          : Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
      'Invalid private key',
    );

    if (!isValidPrivate(privateKeyBuffer)) {
      throw new Error('Invalid private key');
    }

    const address = toChecksumAddress(
      Address.fromPrivateKey(privateKeyBuffer).toString(),
    );
    return { privateKey: privateKeyBuffer.toString('hex'), address };
  }

  async #handleSigningRequest({
    account,
    method,
    params,
  }: {
    account: KeyringAccount;
    method: string;
    params: Json;
  }): Promise<Json> {
    const { chainId } = await provider.getNetwork();
    if (!this.#isSupportedChain(Number(chainId))) {
      throwError(`[Snap] Unsupported chain ID: ${Number(chainId)}`);
    }

    switch (method) {
      case EthMethod.PrepareUserOperation: {
        const transactions = params as EthBaseTransaction[];
        return await this.#prepareUserOperation(account.address, transactions);
      }

      case EthMethod.PatchUserOperation: {
        const [userOp] = params as [EthUserOperation];
        return await this.#patchUserOperation(account.address, userOp);
      }

      case EthMethod.SignUserOperation: {
        const [userOp] = params as [EthUserOperation];
        return await this.#signUserOperation(account.address, userOp);
      }

      default: {
        throw new Error(`EVM method '${method}' not supported`);
      }
    }
  }

  async #prepareUserOperation(
    address: string,
    transactions: EthBaseTransaction[],
  ): Promise<EthBaseUserOperation> {
    if (transactions.length !== 1) {
      throwError(`[Snap] Only one transaction per UserOp supported`);
    }
    const transaction =
      transactions[0] ?? throwError(`[Snap] Transaction is required`);
    logger.info(
      `[Snap] PrepareUserOp for transaction\n: ${JSON.stringify(
        transaction,
        null,
        2,
      )}`,
    );

    const wallet = this.#getWalletByAddress(address);
    const signer = getSigner(wallet.privateKey);

    // eslint-disable-next-line camelcase
    const aaInstance = SimpleAccount__factory.connect(
      wallet.account.address, // AA address
      signer, // Admin signer
    );

    const { chainId } = await provider.getNetwork();

    let nonce = '0x0';
    let initCode = '0x';
    try {
      nonce = `0x${(await aaInstance.getNonce()).toString(16)}`;
      if (!wallet.chains[chainId.toString()]) {
        wallet.chains[chainId.toString()] = true;
        await this.#saveState();
      }
    } catch (error) {
      initCode = wallet.initCode;
    }

    const chainConfig = this.#getChainConfig(Number(chainId));

    const verifyingPaymasterAddress =
      chainConfig?.customVerifyingPaymasterAddress;

    const ethBaseUserOp: EthBaseUserOperation = {
      nonce,
      initCode,
      callData: aaInstance.interface.encodeFunctionData('execute', [
        transaction.to ?? ethers.constants.AddressZero,
        transaction.value ?? '0x00',
        transaction.data ?? ethers.constants.HashZero,
      ]),
      dummySignature: DUMMY_SIGNATURE,
      dummyPaymasterAndData: getDummyPaymasterAndData(
        verifyingPaymasterAddress,
      ),
      bundlerUrl: chainConfig?.bundlerUrl ?? '',
    };
    return ethBaseUserOp;
  }

  async #patchUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<EthUserOperationPatch> {
    const wallet = this.#getWalletByAddress(address);
    const signer = getSigner(wallet.privateKey);
    const { chainId } = await provider.getNetwork();
    const chainConfig = this.#getChainConfig(Number(chainId));

    const verifyingPaymasterAddress =
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      chainConfig?.customVerifyingPaymasterAddress!;

    if (!verifyingPaymasterAddress) {
      return { paymasterAndData: '0x' };
    }

    const verifyingPaymaster = VerifyingPaymaster__factory.connect(
      verifyingPaymasterAddress,
      signer,
    );

    const verifyingSigner = getSigner(
      chainConfig?.customVerifyingPaymasterPK ?? wallet.privateKey,
    );

    // Create a hash that doesn't expire
    const hash = await verifyingPaymaster.getHash(userOp, 0, 0);
    const signature = await verifyingSigner.signMessage(
      ethers.utils.arrayify(hash),
    );
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const paymasterAndData = `${getAddress(
      verifyingPaymaster.address,
    )}${stripHexPrefix(
      ethers.utils.defaultAbiCoder.encode(['uint48', 'uint48'], [0, 0]),
    )}${stripHexPrefix(signature)}`;

    return {
      paymasterAndData,
    };
  }

  async #signUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<string> {
    const wallet = this.#getWalletByAddress(address);
    const signer = getSigner(wallet.privateKey);
    const { chainId } = await provider.getNetwork();
    const entryPoint = await this.#getEntryPoint(Number(chainId), signer);
    logger.info(
      `[Snap] SignUserOperation:\n${JSON.stringify(userOp, null, 2)}`,
    );

    // Sign the userOp
    userOp.signature = '0x';
    const userOpHash = getUserOperationHash(
      userOp,
      getAddress(entryPoint.address),
      chainId.toString(10),
    );

    const signature = await signer.signMessage(
      ethers.utils.arrayify(userOpHash),
    );

    return signature;
  }

  async #getAAFactory(chainId: number, signer: ethers.Wallet) {
    if (!this.#isSupportedChain(chainId)) {
      throwError(`[Snap] Unsupported chain ID: ${chainId}`);
    }
    let factoryAddress: string;
    const chainConfig = this.#getChainConfig(chainId);
    if (chainConfig?.simpleAccountFactory) {
      factoryAddress = chainConfig.simpleAccountFactory;
    } else {
      const entryPointVersion =
        DEFAULT_ENTRYPOINTS[chainId]?.version.toString() ??
        throwError(`[Snap] Unknown EntryPoint for chain ${chainId}`);
      factoryAddress =
        (DEFAULT_AA_FACTORIES[entryPointVersion] as Record<string, string>)?.[
          chainId.toString()
        ] ??
        throwError(
          `[Snap] Unknown AA Factory address for chain ${chainId} and EntryPoint version ${entryPointVersion}`,
        );
    }
    return SimpleAccountFactory__factory.connect(factoryAddress, signer);
  }

  async #getEntryPoint(chainId: number, signer: ethers.Wallet) {
    if (!this.#isSupportedChain(chainId)) {
      throwError(`[Snap] Unsupported chain ID: ${chainId}`);
    }
    const entryPointAddress =
      this.#getChainConfig(chainId)?.entryPoint ??
      DEFAULT_ENTRYPOINTS[chainId]?.address ??
      throwError(`[Snap] Unknown EntryPoint for chain ${chainId}`);

    return EntryPoint__factory.connect(entryPointAddress, signer);
  }

  #getChainConfig(chainId: number): ChainConfig | undefined {
    return this.#state.config?.[chainId];
  }

  #isSupportedChain(chainId: number): boolean {
    return (
      Object.values(CHAIN_IDS).includes(chainId) ||
      Boolean(this.#state.config[chainId])
    );
  }

  async #saveState(): Promise<void> {
    await saveState(this.#state);
  }

  async #emitEvent(
    event: KeyringEvent,
    data: Record<string, Json>,
  ): Promise<void> {
    await emitSnapKeyringEvent(snap, event, data);
  }
}
