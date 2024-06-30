/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable camelcase */
import {
  addHexPrefix,
  Address,
  isValidPrivate,
  // stripHexPrefix,
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
  KeyringEvent,
} from '@metamask/keyring-api';
import type { CaipChainId, Json, JsonRpcRequest } from '@metamask/utils';
import { hexToBytes, parseCaipChainId } from '@metamask/utils';
import { Buffer } from 'buffer';
import type { BigNumberish } from 'ethers';
import { ethers } from 'ethers';
import { v4 as uuid } from 'uuid';

import { CHAIN_IDS } from './constants/chain-ids';
import {
  DUMMY_SIGNATURE,
  getDummyPaymasterAndData,
} from './constants/dummy-values';
import { DEFAULT_ENTRYPOINTS } from './constants/entrypoints';
import { logger } from './logger';
import { saveState } from './stateManagement';
import {
  EntryPoint__factory,
  CoinbaseSmartWallet__factory,
  CoinbaseSmartWalletFactory__factory,
  // VerifyingPaymaster__factory,
} from './types';
import { CaipNamespaces, isEvmChain, toCaipChainId } from './utils/caip';
import { getUserOperationHash } from './utils/ecdsa';
import { getSigner, provider } from './utils/ethers';
import { isUniqueAddress, runSensitive, throwError } from './utils/util';
import { validateConfig } from './utils/validation';

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
  customVerifyingPaymasterSK?: string;
  customVerifyingPaymasterAddress?: string;
};

export type ChainConfigs = Record<string, ChainConfig>;

export type KeyringState = {
  wallets: Record<string, Wallet>;
  config: ChainConfigs;
  usePaymaster: boolean;
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

  /**
   * Set the configuration options for the current chain.
   *
   * @param config - The configuration to set.
   * @throws If the configuration is invalid.
   * @returns The updated configuration for the current chain.
   */
  async setConfig(config: ChainConfig): Promise<ChainConfig> {
    const { chainId } = await provider.getNetwork();

    validateConfig(config);

    this.#state.config[Number(chainId)] = {
      ...this.#state.config[Number(chainId).toString()],
      ...config,
    };

    await this.#saveState();
    return this.#state.config[Number(chainId).toString()]!;
  }

  /**
   * Retrieves the configuration settings for the keyring.
   * @returns A promise that resolves to the ChainConfigs object containing the configuration settings.
   */
  async getConfigs(): Promise<ChainConfigs> {
    return this.#state.config;
  }

  /**
   * List all accounts in the keyring.
   *
   * @returns A list of accounts.
   */
  async listAccounts(): Promise<KeyringAccount[]> {
    return Object.values(this.#state.wallets).map((wallet) => wallet.account);
  }

  /**
   * Get an account by its ID.
   *
   * @param id - The ID of the account to retrieve.
   * @throws If the account is not found.
   * @returns The keyring account with the given ID.
   */
  async getAccount(id: string): Promise<KeyringAccount> {
    return (
      this.#state.wallets[id]?.account ??
      throwError(`Account '${id}' not found`)
    );
  }

  /**
   * Create a new smart contract keyring account.
   * Private key is required to create an account.
   *
   * @param options - The options to use when creating the account (e.g. salt).
   * @throws If the private key is not provided or if the account already exists.
   * @returns The new keyring account.
   */
  async createAccount(
    options: Record<string, Json> = {},
  ): Promise<KeyringAccount> {
    console.log('Creating account 2');
    if (!options.privateKey) {
      throwError(`[Snap] Private Key is required`);
    }

    const { privateKey, address: admin } = this.#getKeyPair(
      options?.privateKey as string | undefined,
    );

    // The private key should not be stored in the account options since the
    // account object is exposed to external components, such as MetaMask and
    // the snap UI.
    if (options?.privateKey) {
      delete options.privateKey;
    }

    const { chainId } = await provider.getNetwork();
    const signer = getSigner(privateKey);

    // get factory contract by chain
    const aaFactory = await this.#getAAFactory(Number(chainId), signer);
    logger.info('[Snap] AA Factory Contract Address: ', aaFactory.target);
    console.log('Chain ID: ', chainId);
    console.log('Target: ', aaFactory.target);

    // const salt = 2;

    // const random = ethers.toBigInt(ethers.randomBytes(32));
    // const salt =
    //   (options.salt as string) ??
    //   ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [random]);

    const salt =
      '0x73c31044ac380f9d678c3a66715e07128c84b728ad7ac39c7c176b80e5fabaf3';
    // const adminAbi = ethers.getBytes(
    //   ethers.AbiCoder.defaultAbiCoder().encode(['address'], [admin]),
    // );

    // const adminAbi = ethers.AbiCoder.defaultAbiCoder().encode(
    //   ['address'],
    //   [admin],
    // );

    const adminAbi = admin;

    console.log('admin: ', admin);
    console.log('adminAbi: ', adminAbi);
    console.log('salt: ', salt);

    // const aaAddress: string = await aaFactory.getAddress(
    //   ['0x97df22132e5b1bea88ffcbbeac278db175212085'],
    //   salt,
    // );
    // const aaAddress = await aaFactory.getAccountAddress(admin, salt);
    const aaAddress = '0x556a19ac087c553dbbd28d63e3879071007394b5';
    console.log('aaAddress9: ', aaAddress);

    if (!isUniqueAddress(aaAddress, Object.values(this.#state.wallets))) {
      throw new Error(
        `[Snap] Account abstraction address already in use: ${aaAddress}`,
      );
    }

    const initCode = ethers.concat([
      aaFactory.target as string,
      aaFactory.interface.encodeFunctionData('createAccount', [
        [adminAbi],
        salt,
      ]),
    ]);
    console.log('Init Code: ', initCode);

    // check on chain if the account already exists.
    // if it does, this means that there is a collision in the salt used.
    const existingDeployment = await provider.getCode(aaAddress);
    const accountCollision = existingDeployment !== '0x';
    console.log('Creating account');
    if (accountCollision) {
      console.log(`${salt}: ${existingDeployment}`);
      throwError(`[Snap] Account Salt already used, please retry.`);
    }

    // Note: this is commented out because the AA is not deployed yet.
    // Will store the initCode and salt in the wallet object to deploy with first transaction later.
    // try {
    //   await aaFactory.createAccount(admin, salt);
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
        chains: {
          [toCaipChainId(CaipNamespaces.Eip155, chainId.toString())]: false,
        },
        salt,
        initCode,
      };
      await this.#emitEvent(KeyringEvent.AccountCreated, { account });
      await this.#saveState();
      return account;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  /**
   * Filter the EVM chains that an account can be used with.
   *
   * @param _id - The ID of the account to filter chains for.
   * @param chains - CAIP-2 chain IDs to filter.
   * @returns The filtered list of EVM chains.
   */
  async filterAccountChains(_id: string, chains: string[]): Promise<string[]> {
    // The `id` argument is not used because all accounts created by this snap
    // are expected to be compatible with any EVM chain.
    return chains.filter((chain) => isEvmChain(chain));
  }

  /**
   * Update a keyring account.
   *
   * @param account - The account to update.
   * @throws if the account does not exist or if the account does not implement EIP-1271.
   */
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

  /**
   * Delete a keyring account.
   *
   * @param id - The ID of the account to delete.
   */
  async deleteAccount(id: string): Promise<void> {
    try {
      await this.#emitEvent(KeyringEvent.AccountDeleted, { id });
      delete this.#state.wallets[id];
      await this.#saveState();
    } catch (error) {
      throwError((error as Error).message);
    }
  }

  /**
   * Submit a request to the keyring.
   *
   * @param request - The keyring request to submit.
   * @returns The response to the request.
   */
  async submitRequest(request: KeyringRequest): Promise<SubmitRequestResponse> {
    return this.#syncSubmitRequest(request);
  }

  async #syncSubmitRequest(
    request: KeyringRequest,
  ): Promise<SubmitRequestResponse> {
    const { method, params = [] } = request.request as JsonRpcRequest;

    switch (method) {
      default: {
        const signature = await this.#handleSigningRequest({
          account: this.#getWalletById(request.account).account,
          method,
          params,
          scope: request.scope,
        });
        return {
          pending: false,
          result: signature,
        };
      }
    }
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
          : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - available in snaps
            Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
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
    scope,
    method,
    params,
  }: {
    account: KeyringAccount;
    scope: string;
    method: string;
    params: Json;
  }): Promise<Json> {
    console.log('Handle signing request 2');
    const { chainId } = await provider.getNetwork();
    try {
      const parsedScope = parseCaipChainId(scope as CaipChainId);
      console.log('Parsed Scope: ', parsedScope);
      if (String(chainId) !== parsedScope.reference) {
        throwError(
          `[Snap] Chain ID '${chainId}' mismatch with scope '${scope}'`,
        );
      }
    } catch (error) {
      throwError(
        `[Snap] Error parsing request scope '${scope}': ${
          (error as Error).message
        }`,
      );
    }
    if (!this.#isSupportedChain(Number(chainId))) {
      throwError(`[Snap] Unsupported chain ID: ${Number(chainId)}`);
    }
    if (!this.#doesAccountSupportChain(account.id, scope)) {
      throwError(`[Snap] Account does not support chain: ${scope}`);
    }

    console.log('Method: ', method);
    switch (method) {
      case EthMethod.PrepareUserOperation: {
        const transactions = params as EthBaseTransaction[];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore-error will fix type in next PR
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
    console.log('prepareUserOperation 3');
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
    console.log('Wallet: ', wallet);
    console.log('Address: ', address);
    console.log('Address2: ', wallet.account.address);
    const signer = getSigner(wallet.privateKey);

    // eslint-disable-next-line camelcase
    const aaInstance = CoinbaseSmartWallet__factory.connect(
      wallet.account.address, // AA address
      signer, // Admin signer
    );

    const { chainId } = await provider.getNetwork();
    console.log('Chain ID: ', chainId);

    let nonce = '0x0';
    let initCode = '0x';
    try {
      nonce = `0x${(0 as BigNumberish).toString(
        // nonce = `0x${((await aaInstance.getNonce()) as BigNumberish).toString(
        16,
      )}`;
      console.log('Nonce: ', nonce);
      const scope = toCaipChainId(CaipNamespaces.Eip155, chainId.toString());
      console.log('Scope: ', scope);
      if (!Object.prototype.hasOwnProperty.call(wallet.chains, scope)) {
        console.log('No scope');
        wallet.chains[scope] = true;
        await this.#saveState();
      }
    } catch (error) {
      initCode = wallet.initCode;
    }

    initCode =
      '0x2b7849ba6b6ddd8df017fc9fc171eb88e774a32e3ffba36f000000000000000000000000000000000000000000000000000000000000004073c31044ac380f9d678c3a66715e07128c84b728ad7ac39c7c176b80e5fabaf900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001497df22132e5b1bea88ffcbbeac278db175212085000000000000000000000000';
    // const chainConfig = this.#getChainConfig(Number(chainId));
    // if (!chainConfig?.bundlerUrl) {
    //   console.log('No bundler URL');
    //   throwError(`[Snap] Bundler URL not found for chain: ${chainId}`);
    // }

    // const verifyingPaymasterAddress =
    //   chainConfig?.customVerifyingPaymasterAddress;

    const bundlerUrl =
      'https://bundler.biconomy.io/api/v2/84532/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44';
    // 'https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44';
    const ethBaseUserOp: EthBaseUserOperation = {
      nonce,
      initCode,
      callData: aaInstance.interface.encodeFunctionData('execute', [
        transaction.to ?? ethers.ZeroAddress,
        transaction.value ?? '0x00',
        transaction.data ?? ethers.ZeroHash,
      ]),
      dummySignature: DUMMY_SIGNATURE,
      dummyPaymasterAndData: getDummyPaymasterAndData(undefined),
      bundlerUrl,
    };

    console.log('EthBaseUserOp: ', ethBaseUserOp);
    return ethBaseUserOp;
  }

  async #patchUserOperation(
    _address: string,
    _userOp: EthUserOperation,
  ): Promise<EthUserOperationPatch> {
    console.log('Patch User Operation');
    return { paymasterAndData: '0x' };

    // const wallet = this.#getWalletByAddress(address);
    // const signer = getSigner(wallet.privateKey);
    // const { chainId } = await provider.getNetwork();
    // const chainConfig = this.#getChainConfig(Number(chainId));

    // const verifyingPaymasterAddress =
    //   // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    //   chainConfig?.customVerifyingPaymasterAddress!;

    // if (!verifyingPaymasterAddress) {
    //   return { paymasterAndData: '0x' };
    // }

    // const verifyingPaymaster = VerifyingPaymaster__factory.connect(
    //   verifyingPaymasterAddress,
    //   signer,
    // );

    // const verifyingSigner = getSigner(
    //   chainConfig?.customVerifyingPaymasterSK ?? wallet.privateKey,
    // );

    // // Create a hash that doesn't expire
    // const hash = await verifyingPaymaster.getHash(userOp, 0, 0);
    // const signature = await verifyingSigner.signMessage(ethers.getBytes(hash));
    // // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    // const paymasterAndData = `${await verifyingPaymaster.getAddress()}${stripHexPrefix(
    //   ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [0, 0]),
    // )}${stripHexPrefix(signature)}`;

    // return {
    //   paymasterAndData,
    // };
  }

  async #signUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<string> {
    const wallet = this.#getWalletByAddress(address);
    console.log('SIGN USER OPERATION', address);
    const signer = getSigner(wallet.privateKey);
    const { chainId } = await provider.getNetwork();
    console.log('Chain ID: ', chainId);
    const entryPoint = await this.#getEntryPoint(Number(chainId), signer);
    logger.info(
      `[Snap] SignUserOperation:\n${JSON.stringify(userOp, null, 2)}`,
    );

    // Sign the userOp
    userOp.signature = '0x';
    const userOpHash = getUserOperationHash(
      userOp,
      await entryPoint.getAddress(),
      chainId.toString(10),
    );

    const signature = await signer.signMessage(ethers.getBytes(userOpHash));

    return signature;
  }

  async #getAAFactory(chainId: number, signer: ethers.Wallet) {
    // if (!this.#isSupportedChain(chainId)) {
    //   throwError(`[Snap] Unsupported chain ID: ${chainId}`);
    // }
    // let factoryAddress: string;
    // const chainConfig = this.#getChainConfig(chainId);
    // if (chainConfig?.simpleAccountFactory) {
    //   factoryAddress = chainConfig.simpleAccountFactory;
    // } else {
    //   const entryPointVersion =
    //     DEFAULT_ENTRYPOINTS[chainId]?.version.toString() ??
    //     throwError(`[Snap] Unknown EntryPoint for chain ${chainId}`);
    //   factoryAddress =
    //     (DEFAULT_AA_FACTORIES[entryPointVersion] as Record<string, string>)?.[
    //       chainId.toString()
    //     ] ??
    //     throwError(
    //       `[Snap] Unknown AA Factory address for chain ${chainId} and EntryPoint version ${entryPointVersion}`,
    //     );
    // }
    return CoinbaseSmartWalletFactory__factory.connect(
      '0x2b7849Ba6B6DDd8df017FC9fC171EB88E774a32E',
      signer,
    );
    // return CoinbaseSmartWalletFactory__factory.connect(factoryAddress, signer);
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

  #doesAccountSupportChain(accountId: string, scope: string): boolean {
    const wallet = this.#getWalletById(accountId);
    return Object.prototype.hasOwnProperty.call(wallet.chains, scope);
  }

  async togglePaymasterUsage(): Promise<void> {
    const updatedState = {
      ...this.#state,
      usePaymaster: !this.#state.usePaymaster,
    };

    this.#state = updatedState;

    await saveState(updatedState);
  }

  isUsingPaymaster(): boolean {
    return this.#state.usePaymaster;
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
