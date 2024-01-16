import {
  addHexPrefix,
  Address,
  isValidPrivate,
  toChecksumAddress,
} from '@ethereumjs/util';
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
import {
  emitSnapKeyringEvent,
  EthAccountType,
  EthMethod,
} from '@metamask/keyring-api';
import { KeyringEvent } from '@metamask/keyring-api/dist/events';
import { hexToBytes, type Json, type JsonRpcRequest } from '@metamask/utils';
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import { defaultAbiCoder, hexConcat, keccak256 } from 'ethers/lib/utils';
import * as process from 'process';
import { v4 as uuid } from 'uuid';

import { DEFAULT_AA_FACTORIES } from './constants/aa-factories';
import { CHAIN_IDS } from './constants/chain-ids';
import {
  DUMMY_GAS_VALUES,
  DUMMY_PAYMASTER_AND_DATA,
  DUMMY_SIGNATURE,
} from './constants/dummy-values';
import { DEFAULT_ENTRYPOINTS } from './constants/entrypoints';
import { logger } from './logger';
import { saveState } from './stateManagement';
import {
  EntryPoint__factory,
  SimpleAccount__factory,
  SimpleAccountFactory__factory,
} from './types';
import { getSigner, provider } from './utils/ethers';
import {
  deepHexlify,
  isEvmChain,
  isUniqueAddress,
  runSensitive,
  throwError,
} from './utils/util';

const unsupportedAAMethods = [
  EthMethod.SignTransaction,
  EthMethod.Sign,
  EthMethod.PersonalSign,
  EthMethod.SignTypedDataV1,
  EthMethod.SignTypedDataV3,
  EthMethod.SignTypedDataV4,
];

export type KeyringState = {
  wallets: Record<string, Wallet>;
  pendingRequests: Record<string, KeyringRequest>;
};

export type Wallet = {
  account: KeyringAccount;
  admin: string;
  privateKey: string;
  chains: Record<string, boolean>;
  initCode: string;
};

export class AccountAbstractionKeyring implements Keyring {
  #state: KeyringState;

  constructor(state: KeyringState) {
    this.#state = state;
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
    if (!options.privateKey) {
      throwError(`[Snap] Private Key is required`);
    }

    const { privateKey, address: admin } = this.#getKeyPair(
      options?.privateKey as string | undefined,
    );

    if (!isUniqueAddress(admin, Object.values(this.#state.wallets))) {
      throw new Error(`Account address already in use: ${admin}`);
    }
    // The private key should not be stored in the account options since the
    // account object is exposed to external components, such as MetaMask and
    // the snap UI.
    if (options?.privateKey) {
      delete options.privateKey;
    }

    const { chainId } = await provider.getNetwork();
    const signer = getSigner(privateKey);

    // get factory contract by chain
    const aaFactory = await this.#getAAFactory(chainId, signer);
    logger.info('[Snap] AA Factory Contract Address: ', aaFactory.address);

    const salt = keccak256(
      defaultAbiCoder.encode(
        ['uint256'],
        [crypto.getRandomValues(new Uint32Array(10))],
      ),
    );

    const aaAddress = await aaFactory.getAddress(admin, salt);
    const initCode = hexConcat([
      aaFactory.address,
      aaFactory.interface.encodeFunctionData('createAccount', [admin, salt]),
    ]);

    // check on chain if the account already exists.
    // if it does, this means that there is a collision in the salt used.
    const accountCollision = (await provider.getCode(aaAddress)) !== '0x';
    if (accountCollision) {
      throwError(`[Snap] Account Salt already used, please retry.`);
    }

    // Note: this is commented out because the AA is not deployed yet.
    // Will store the initCode in the wallet object to deploy with first transaction later.
    // try {
    //   await aaFactory.createAccount(address, salt);
    //   logger.info('[Snap] Deployed AA Account Successfully');
    // } catch (error) {
    //   logger.error(`Error to deploy AA: ${(error as Error).message}`);
    // }

    try {
      const account: KeyringAccount = {
        id: uuid(),
        options,
        address: aaAddress,
        methods: [
          // 4337 methods
          EthMethod.PrepareUserOperation,
          EthMethod.PatchUserOperation,
          EthMethod.SignUserOperation,
        ],
        type: EthAccountType.Erc4337,
      };
      this.#state.wallets[account.id] = {
        account,
        admin, // Address of the admin account from private key
        privateKey,
        chains: { [chainId.toString()]: false },
        initCode,
      };
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
    const { request } =
      this.#state.pendingRequests[id] ??
      throwError(`Request '${id}' not found`);

    const result = await this.#handleSigningRequest(
      request.method,
      request.params ?? [],
    );

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
    const signature = await this.#handleSigningRequest(method, params);
    return {
      pending: false,
      result: signature,
    };
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

  async #handleSigningRequest(method: string, params: Json): Promise<Json> {
    const { chainId } = await provider.getNetwork();
    if (!this.#isSupportedChain(chainId)) {
      throwError(`[Snap] Unsupported chain ID: ${chainId}`);
    }
    switch (method) {
      case EthMethod.PrepareUserOperation: {
        const [from, data] = params as [string, Json];
        const transactions: EthBaseTransaction[] = JSON.parse(data as string);
        return await this.#prepareUserOperation(from, transactions);
      }

      case EthMethod.PatchUserOperation: {
        const [from, data] = params as [string, Json];
        const userOp: EthUserOperation = JSON.parse(data as string);
        return await this.#patchUserOperation(from, userOp);
      }

      case EthMethod.SignUserOperation: {
        const [from, data] = params as [string, Json];
        const userOp: EthUserOperation = JSON.parse(data as string);
        return await this.#signUserOperation(from, userOp);
      }

      default: {
        throw new Error(`EVM method '${method}' not supported`);
      }
    }
  }

  async #prepareUserOperation(
    address: string,
    transactions: EthBaseTransaction[],
  ): Promise<Json> {
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
    const ethBaseUserOp: EthBaseUserOperation = {
      nonce: aaInstance.getNonce().toString(),
      initCode: wallet.initCode,
      callData: aaInstance.interface.encodeFunctionData('execute', [
        transaction.to ?? ethers.constants.AddressZero,
        transaction.value,
        transaction.data ?? '0x',
      ]),
      dummySignature: DUMMY_SIGNATURE,
      dummyPaymasterAndData: DUMMY_PAYMASTER_AND_DATA,
      bundlerUrl: process.env.BUNDLER_URL ?? '',
      gasLimits: DUMMY_GAS_VALUES,
    };
    return JSON.stringify(ethBaseUserOp, null, 2);
  }

  async #patchUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<EthUserOperationPatch> {
    // (@monte) If snap has paymaster, return paymaster and data
    const paymaster = process.env.PAYMASTER_URL ?? '';
    logger.info(
      `[Snap] PatchUserOp for userOp:\n${JSON.stringify(
        userOp,
        null,
        2,
      )}\nwith paymaster: ${paymaster}`,
    );
    // return the patched userOp as Json for #handleSigningRequest
  }

  async #signUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<string> {
    const wallet = this.#getWalletByAddress(address);
    const signer = getSigner(wallet.privateKey);
    const { chainId } = await provider.getNetwork();
    const entryPoint = await this.#getEntryPoint(chainId, signer);
    logger.info(
      `[Snap] SignUserOperation:\n${JSON.stringify(userOp, null, 2)}`,
    );

    // Sign the userOp
    userOp.signature = '0x';
    const userOpHash = ethers.utils.arrayify(
      await entryPoint.getUserOpHash(userOp),
    );
    const signature = await signer.signMessage(userOpHash);
    // Deploy the account on first transaction if not deployed yet
    if (!wallet.chains[chainId.toString()]) {
      const aaFactory = await this.#getAAFactory(chainId, signer);
      try {
        await aaFactory.createAccount(address, salt);
        const aaAddress = wallet.account.address;
        if (
          (await provider.getCode(aaAddress).then((code) => code.length)) === 2
        ) {
          throwError('[Snap] Failed to deploy');
        }
        logger.info(`[Snap] Deployed AA Account Successfully`);
        wallet.chains[chainId.toString()] = true;
      } catch (error) {
        logger.error(`Error to deploy AA: ${(error as Error).message}`);
      }
    }
    return deepHexlify({ ...userOp, signature });
  }

  async #getAAFactory(chainId: number, signer: ethers.Wallet) {
    if (!this.#isSupportedChain(chainId)) {
      throwError(`[Snap] Unsupported chain ID: ${chainId}`);
    }
    const entryPointVersion =
      DEFAULT_ENTRYPOINTS[chainId]?.version.toString() ??
      throwError(`[Snap] Unknown EntryPoint for chain ${chainId}`);

    const chainName = this.#getChainNameFromId(chainId);
    const factoryAddress =
      DEFAULT_AA_FACTORIES[entryPointVersion]?.[chainName] ??
      throwError(
        `[Snap] Unknown AA Factory address for chain ${chainId} and EntryPoint version ${entryPointVersion}`,
      );

    return SimpleAccountFactory__factory.connect(factoryAddress, signer);
  }

  async #getEntryPoint(chainId: number, signer: ethers.Wallet) {
    if (!this.#isSupportedChain(chainId)) {
      throwError(`[Snap] Unsupported chain ID: ${chainId}`);
    }
    const entryPointAddress =
      DEFAULT_ENTRYPOINTS[chainId]?.address ??
      throwError(`[Snap] Unknown EntryPoint for chain ${chainId}`);

    return EntryPoint__factory.connect(entryPointAddress, signer);
  }

  #getChainNameFromId(chainId: number): keyof typeof CHAIN_IDS {
    const entries = Object.entries(CHAIN_IDS) as [
      keyof typeof CHAIN_IDS,
      number,
    ][];
    const found = entries.find(([, value]) => value === chainId);
    if (!found) {
      throwError(`[Snap] Unknown chain ID: ${chainId}`);
    }
    return found[0];
  }

  #isSupportedChain(chainId: number): boolean {
    return Object.values(CHAIN_IDS).includes(chainId);
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
