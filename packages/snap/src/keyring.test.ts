/* eslint-disable camelcase */
/* eslint-disable n/no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { stripHexPrefix } from '@ethereumjs/util';
import type {
  EthBaseUserOperation,
  EthUserOperation,
  KeyringAccount,
} from '@metamask/keyring-api';
import { EthMethod } from '@metamask/keyring-api';
import type { Signer } from 'ethers';
import { ethers } from 'hardhat';
import * as jestExtended from 'jest-extended';
import { v4 } from 'uuid';

import {
  DUMMY_SIGNATURE,
  getDummyPaymasterAndData,
} from './constants/dummy-values';
import type { ChainConfig, KeyringState } from './keyring';
import { AccountAbstractionKeyring } from './keyring';
import * as stateManagement from './stateManagement';
import type {
  EntryPoint,
  SimpleAccountFactory,
  VerifyingPaymaster,
} from './types';
import {
  EntryPoint__factory,
  SimpleAccount__factory,
  SimpleAccountFactory__factory,
  VerifyingPaymaster__factory,
} from './types';
import { CaipNamespaces, toCaipChainId } from './utils/caip';
import { getUserOperationHash } from './utils/ecdsa';
import { provider } from './utils/ethers';

expect.extend(jestExtended);

const mockAccountId = 'ea747116-767c-4117-a347-0c3f7b19cc5a';
const nonExistentAccountId = 'non-existent-id';
const TEST_MNEMONIC =
  'test test test test test test test test test test test junk';
const chainId = '11155111';
const scope = toCaipChainId(CaipNamespaces.Eip155, chainId);
let accountCreationCount = 0;

// This mocks the ethereum global object thats available in the Snaps Execution Environment
jest.mock('../src/utils/ethers', () => ({
  ...jest.requireActual('hardhat'),
  provider: ethers.provider,
  getSigner: (privateKey: string) =>
    new ethers.Wallet(privateKey, ethers.provider),
}));

// This mocks the uuid library to generate a predictable mock account ID for the first account created and a random one for the rest
jest.mock('uuid', () => {
  return {
    v4: () => {
      accountCreationCount += 1;
      return accountCreationCount === 1
        ? mockAccountId
        : jest.requireActual('uuid').v4();
    },
  };
});

// @ts-expect-error Mocking Snap global object
global.snap = {
  request: jest.fn(),
  emitEvent: jest.fn(),
};

const getInitialState = (): KeyringState => ({
  wallets: {},
  config: {},
  usePaymaster: false,
});

const saveStateWillThrow = (message: string) => {
  jest.spyOn(stateManagement, 'saveState').mockImplementationOnce(async () => {
    throw new Error(message);
  });
};
const failedToSaveStateError = 'Failed to save state';

const aaAccountInterface = new SimpleAccount__factory();
const simpleAccountFactoryInterface = new SimpleAccountFactory__factory();

describe('Keyring', () => {
  let aaOwner: Signer;
  let aaOwnerSk: string;
  let keyring: AccountAbstractionKeyring;
  let simpleAccountFactory: SimpleAccountFactory;
  let entryPoint: EntryPoint;
  let verifyingPaymaster: VerifyingPaymaster;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    aaOwner = signers[0]!;
    aaOwnerSk = ethers.Wallet.fromPhrase(TEST_MNEMONIC).privateKey;
    entryPoint = await new EntryPoint__factory(aaOwner).deploy();

    verifyingPaymaster = await new VerifyingPaymaster__factory(aaOwner).deploy(
      await entryPoint.getAddress(),
      await aaOwner.getAddress(),
    );

    simpleAccountFactory = await new SimpleAccountFactory__factory(
      aaOwner,
    ).deploy(await entryPoint.getAddress());

    keyring = new AccountAbstractionKeyring({ ...getInitialState() });

    await keyring.setConfig({
      simpleAccountFactory: await simpleAccountFactory.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      customVerifyingPaymasterAddress: await verifyingPaymaster.getAddress(),
      bundlerUrl: 'http://mock-bundler-url.com',
    });
  });

  afterEach(() => {
    accountCreationCount = 0;
  });

  describe('Constructor', () => {
    it('should create a new keyring with default state', async () => {
      expect(keyring).toBeDefined();
      expect(await keyring.listAccounts()).toStrictEqual([]);
    });
  });

  describe('Set Config', () => {
    let config: ChainConfig;

    beforeEach(async () => {
      config = {
        simpleAccountFactory: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        entryPoint: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        bundlerUrl: 'https://bundler.example.com/rpc',
        customVerifyingPaymasterSK: aaOwnerSk,
        customVerifyingPaymasterAddress:
          '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      };
    });

    const testCases = [
      {
        field: 'simpleAccountFactory',
        value: '0xNotAnAddress',
        errorMessage: 'Invalid Simple Account Factory Address',
      },
      {
        field: 'entryPoint',
        value: '0xNotAnAddress',
        errorMessage: 'Invalid Entry Point Address',
      },
      {
        field: 'customVerifyingPaymasterAddress',
        value: '0xNotAnAddress',
        errorMessage: 'Invalid Custom Verifying Paymaster Address',
      },
      {
        field: 'bundlerUrl',
        value: 'ftp:/invalid.fake.io',
        errorMessage: 'Invalid Bundler URL',
      },
      {
        field: 'customVerifyingPaymasterSK',
        value: '123NotAPrivateKey456',
        errorMessage: 'Invalid Custom Verifying Paymaster Secret Key',
      },
    ];

    testCases.forEach(({ field, value, errorMessage }) => {
      it(`should not set the config with an invalid ${field}`, async () => {
        const invalidConfig = { ...config, [field]: value };
        await expect(keyring.setConfig(invalidConfig)).rejects.toThrow(
          `[Snap] ${errorMessage}: ${value}`,
        );
      });
    });

    it('should set the config', async () => {
      const keyringConfig = await keyring.setConfig(config);
      expect(keyringConfig).toStrictEqual(config);
    });
  });

  describe('Create Account', () => {
    it('should not create a new account without admin private key', async () => {
      await expect(keyring.createAccount()).rejects.toThrow(
        '[Snap] Private Key is required',
      );
    });

    it('should create a new account', async () => {
      const account = await keyring.createAccount({ privateKey: aaOwnerSk });
      expect(account).toBeDefined();
      expect(await keyring.getAccount(account.id)).toStrictEqual(account);
    });

    it('should create a new account with salt', async () => {
      const salt = '0x123';
      const expectedAddressFromSalt =
        await simpleAccountFactory.getAccountAddress(
          await aaOwner.getAddress(),
          salt,
        );
      const account = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt,
      });
      expect(account).toBeDefined();
      expect(await keyring.getAccount(account.id)).toStrictEqual(account);
      expect(account.address).toBe(expectedAddressFromSalt);
      const accountFromDifferentSalt = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt: '0x124',
      });
      expect(accountFromDifferentSalt.address).not.toBe(
        expectedAddressFromSalt,
      );
    });

    it('should not create an account already in use', async () => {
      const salt = '0x123';
      const expectedAddressFromSalt =
        await simpleAccountFactory.getAccountAddress(
          await aaOwner.getAddress(),
          salt,
        );
      const account = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt,
      });
      expect(account).toBeDefined();
      expect(await keyring.getAccount(account.id)).toStrictEqual(account);
      expect(account.address).toBe(expectedAddressFromSalt);
      await expect(
        keyring.createAccount({ privateKey: aaOwnerSk, salt }),
      ).rejects.toThrow(
        `[Snap] Account abstraction address already in use: ${expectedAddressFromSalt}`,
      );
    });

    it('should throw an error when saving state fails', async () => {
      saveStateWillThrow(failedToSaveStateError);
      await expect(
        keyring.createAccount({ privateKey: aaOwnerSk }),
      ).rejects.toThrow(failedToSaveStateError);
    });

    describe('#getKeyPair', () => {
      it('should throw an error for an invalid private key', async () => {
        const invalidPrivateKey = '0xa1b2c3';
        await expect(
          keyring.createAccount({ privateKey: invalidPrivateKey }),
        ).rejects.toThrow('Invalid private key');
      });
    });

    describe('#getAAFactory', () => {
      it('should throw an error if not on a supported chain', async () => {
        const unsupportedChainId = BigInt(11297108109);
        const mockedNetwork = {
          name: 'palm',
          chainId: unsupportedChainId,
          ensAddress: null,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _defaultProvider: () => null,
        };

        const getNetworkSpy = jest
          .spyOn(ethers.provider, 'getNetwork')
          .mockResolvedValue(mockedNetwork as any);

        await expect(
          keyring.createAccount({ privateKey: aaOwnerSk }),
        ).rejects.toThrow(
          `[Snap] Unsupported chain ID: ${unsupportedChainId.toString()}`,
        );

        getNetworkSpy.mockRestore();
      });
    });
  });

  describe('List Accounts', () => {
    it('should list the created accounts', async () => {
      const account1 = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt: '0x123',
      });
      const account2 = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt: '0x456',
      });
      const account3 = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt: '0x789',
      });

      const accounts = await keyring.listAccounts();
      expect(accounts).toIncludeSameMembers([account1, account2, account3]);
    });
  });

  describe('Filter Account Chains', () => {
    it('should correctly filter out non-EVM chains', async () => {
      const chains = [
        'eip155:1',
        'eip155:137',
        'solana:101',
        'eip155:59144',
        'non-evm:100',
        'eip155:56',
        'non-evm:200',
      ];
      const expectedFilteredChains = [
        'eip155:1',
        'eip155:137',
        'eip155:59144',
        'eip155:56',
      ];

      const filteredChains = await keyring.filterAccountChains(
        mockAccountId,
        chains,
      );

      expect(filteredChains).toStrictEqual(expectedFilteredChains);
    });
  });

  describe('Update Account', () => {
    let aaAccount: KeyringAccount;

    beforeEach(async () => {
      aaAccount = await keyring.createAccount({ privateKey: aaOwnerSk });
    });

    it('should update an account', async () => {
      const updatedAccount = { ...aaAccount, options: { updated: true } };
      await keyring.updateAccount(updatedAccount);
      const storedAccount = await keyring.getAccount(aaAccount.id);
      expect(storedAccount.options.updated).toBe(true);
    });

    it('should throw an error when trying to update a non-existent account', async () => {
      const nonExistentAccount: KeyringAccount = {
        id: nonExistentAccountId,
        options: {
          updated: true,
        },
        type: 'eip155:eoa',
        address: aaAccount.address,
        methods: aaAccount.methods,
      };
      await expect(keyring.updateAccount(nonExistentAccount)).rejects.toThrow(
        `Account '${nonExistentAccountId}' not found`,
      );
    });

    it('should throw an error if the account does not implement EIP-1271', async () => {
      const updatedAccount: KeyringAccount = {
        ...aaAccount,
        methods: [EthMethod.PersonalSign],
      };
      await expect(keyring.updateAccount(updatedAccount)).rejects.toThrow(
        `[Snap] Account does not implement EIP-1271`,
      );
      updatedAccount.methods = [EthMethod.SignTypedDataV4];
      await expect(keyring.updateAccount(updatedAccount)).rejects.toThrow(
        `[Snap] Account does not implement EIP-1271`,
      );
    });

    it('should throw an error when saving state fails', async () => {
      saveStateWillThrow(failedToSaveStateError);
      await expect(
        keyring.updateAccount({
          ...aaAccount,
          options: { updated: true },
        }),
      ).rejects.toThrow(failedToSaveStateError);
    });
  });

  describe('Delete Account', () => {
    it('should delete an account', async () => {
      const account = await keyring.createAccount({ privateKey: aaOwnerSk });
      await keyring.deleteAccount(account.id);
      await expect(keyring.getAccount(account.id)).rejects.toThrow(
        `Account '${account.id}' not found`,
      );
      expect(await keyring.listAccounts()).toStrictEqual([]);
    });

    it('should not throw an error when trying to delete a non-existent account', async () => {
      expect(await keyring.deleteAccount(nonExistentAccountId)).toBeUndefined();
    });

    it('should throw an error when saving state fails', async () => {
      saveStateWillThrow(failedToSaveStateError);
      await expect(keyring.deleteAccount(mockAccountId)).rejects.toThrow(
        failedToSaveStateError,
      );
    });
  });

  describe('UserOperations Methods', () => {
    let aaAccount: KeyringAccount;
    let initCode: string;
    const salt = '0x123';

    beforeEach(async () => {
      aaAccount = await keyring.createAccount({
        privateKey: aaOwnerSk,
        salt,
      });

      initCode = ethers.concat([
        ethers.getBytes(await simpleAccountFactory.getAddress()),
        ethers.getBytes(
          simpleAccountFactoryInterface.interface.encodeFunctionData(
            'createAccount',
            [await aaOwner.getAddress(), salt],
          ),
        ),
      ]);
    });

    describe('#prepareUserOperation', () => {
      it('should prepare a new user operation', async () => {
        const intent = {
          to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
          value: '0x00',
          data: ethers.ZeroHash,
        };
        const expectedCallData =
          aaAccountInterface.interface.encodeFunctionData(
            'execute',
            Object.values(intent),
          );

        const expected = {
          pending: false,
          result: {
            nonce: '0x0',
            initCode: expect.any(String), // not testing the init code here
            callData: expectedCallData,
            dummySignature:
              '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
            dummyPaymasterAndData: getDummyPaymasterAndData(
              await verifyingPaymaster.getAddress(),
            ),
            bundlerUrl: expect.any(String),
          },
        };

        const op = await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope,
          account: mockAccountId,
          request: {
            method: 'eth_prepareUserOperation',
            params: [intent],
          },
        });

        expect(op).toStrictEqual(expected);
      });

      it('should prepare a new user operation with init code', async () => {
        const intent = {
          to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
          value: '0x00',
          data: ethers.ZeroHash,
        };
        const expectedCallData =
          aaAccountInterface.interface.encodeFunctionData(
            'execute',
            Object.values(intent),
          );

        const expected = {
          pending: false,
          result: {
            nonce: '0x0',
            initCode,
            callData: expectedCallData,
            dummySignature:
              '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
            dummyPaymasterAndData: getDummyPaymasterAndData(
              await verifyingPaymaster.getAddress(),
            ),
            bundlerUrl: expect.any(String),
          },
        };

        const op = (await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope,
          account: mockAccountId,
          request: {
            method: 'eth_prepareUserOperation',
            params: [intent],
          },
        })) as { pending: false; result: EthBaseUserOperation };

        expect(op).toStrictEqual(expected);
        expect(op.result.initCode).toBe(initCode);
      });

      it('should throw an error for a number of transactions that is not 1', async () => {
        const intents = [
          [
            {
              to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
              value: '0x00',
              data: ethers.ZeroHash,
            },
            {
              to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
              value: '0x00',
              data: ethers.ZeroHash,
            },
          ],
          [],
        ];

        for (const intent of intents) {
          await expect(
            keyring.submitRequest({
              id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
              scope,
              account: mockAccountId,
              request: {
                method: 'eth_prepareUserOperation',
                params: intent,
              },
            }),
          ).rejects.toThrow('[Snap] Only one transaction per UserOp supported');
        }
      });
    });

    describe('#patchUserOperation', () => {
      it('should return a valid paymasterAndData', async () => {
        const userOperation: EthUserOperation = {
          sender: aaAccount.address,
          nonce: '0x00',
          initCode: '0x',
          callData:
            '0xb61d27f600000000000000000000000097a0924bf222499cba5c29ea746e82f2307302930000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000',
          signature: DUMMY_SIGNATURE,
          paymasterAndData: '0x',
          callGasLimit: '0x58a83',
          verificationGasLimit: '0xe8c4',
          preVerificationGas: '0xc57c',
          maxFeePerGas: '0x11',
          maxPriorityFeePerGas: '0x11',
        };

        const operation = (await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope,
          account: mockAccountId,
          request: {
            method: 'eth_patchUserOperation',
            params: [userOperation],
          },
        })) as { pending: false; result: { paymasterAndData: string } };

        const localVerifying = VerifyingPaymaster__factory.connect(
          await verifyingPaymaster.getAddress(),
          ethers.provider,
        );

        const hash = await localVerifying.getHash(userOperation, 0, 0);
        const expectedSignature = await aaOwner.signMessage(
          ethers.getBytes(hash),
        );
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        const expectedPaymasterAndData = `${await verifyingPaymaster.getAddress()}${stripHexPrefix(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['uint48', 'uint48'],
            [0, 0],
          ),
        )}${stripHexPrefix(expectedSignature)}`;

        expect(operation.result.paymasterAndData).toBe(
          expectedPaymasterAndData,
        );

        const userOperationWithPaymasterAndData = {
          ...userOperation,
          paymasterAndData: operation.result.paymasterAndData,
        };

        const result = await localVerifying.validatePaymasterUserOp.staticCall(
          userOperationWithPaymasterAndData,
          '0x'.padEnd(66, '0'),
          1,
          { from: await entryPoint.getAddress() },
        );

        const packedResult = result[1].toString(16);

        expect(packedResult).toBe('1');
      });

      it("should return '0x' paymasterAndData if 'customVerifyingPaymasterAddress' not set in chain config", async () => {
        const keyringWithoutCustomVerifyingPaymaster =
          new AccountAbstractionKeyring({ ...getInitialState() });
        await keyringWithoutCustomVerifyingPaymaster.setConfig({
          simpleAccountFactory: await simpleAccountFactory.getAddress(),
          entryPoint: await entryPoint.getAddress(),
        });
        const account =
          await keyringWithoutCustomVerifyingPaymaster.createAccount({
            privateKey: aaOwnerSk,
          });

        const userOperation: EthUserOperation = {
          sender: account.address,
          nonce: '0x00',
          initCode: '0x',
          callData:
            '0xb61d27f600000000000000000000000097a0924bf222499cba5c29ea746e82f2307302930000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000',
          signature: DUMMY_SIGNATURE,
          paymasterAndData: '0x',
          callGasLimit: '0x58a83',
          verificationGasLimit: '0xe8c4',
          preVerificationGas: '0xc57c',
          maxFeePerGas: '0x11',
          maxPriorityFeePerGas: '0x11',
        };

        const operation =
          (await keyringWithoutCustomVerifyingPaymaster.submitRequest({
            id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
            scope,
            account: account.id,
            request: {
              method: 'eth_patchUserOperation',
              params: [userOperation],
            },
          })) as { pending: false; result: { paymasterAndData: string } };

        expect(operation.result.paymasterAndData).toBe('0x');
      });
    });

    describe('#signUserOperation', () => {
      it('should sign a user operation', async () => {
        const userOperation: EthUserOperation = {
          sender: aaAccount.address,
          nonce: '0x00',
          initCode: '0x',
          callData:
            '0xb61d27f600000000000000000000000097a0924bf222499cba5c29ea746e82f2307302930000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000',
          signature: '0x',
          paymasterAndData: '0x',
          callGasLimit: '0x58a83',
          verificationGasLimit: '0xe8c4',
          preVerificationGas: '0xc57c',
          maxFeePerGas: '0x11',
          maxPriorityFeePerGas: '0x11',
        };

        const userOpHash = getUserOperationHash(
          userOperation,
          await entryPoint.getAddress(),
          chainId.toString(),
        );

        const expectedSignature = await aaOwner.signMessage(
          ethers.getBytes(userOpHash),
        );

        const operation = (await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope,
          account: mockAccountId,
          request: {
            method: 'eth_signUserOperation',
            params: [userOperation],
          },
        })) as { pending: false; result: string };

        expect(operation.result).toBe(expectedSignature);
      });

      it('should sign a user operation with init code and deploy the account', async () => {
        // Fund the entry point with a deposit
        await entryPoint.depositTo(aaAccount.address, {
          value: ethers.parseEther('1'),
        });

        const userOperation: EthUserOperation = {
          sender: aaAccount.address,
          nonce: '0x00',
          initCode,
          callData:
            '0xb61d27f600000000000000000000000097a0924bf222499cba5c29ea746e82f2307302930000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000',
          signature: '0x',
          paymasterAndData: '0x',
          // Need more gas for deployment
          callGasLimit: '0x7A120',
          verificationGasLimit: '0x7A120',
          preVerificationGas: '0x7A120',
          maxFeePerGas: '0x11',
          maxPriorityFeePerGas: '0x11',
        };

        const userOpHash = getUserOperationHash(
          userOperation,
          await entryPoint.getAddress(),
          chainId.toString(),
        );

        const expectedSignature = await aaOwner.signMessage(
          ethers.getBytes(userOpHash),
        );

        const operation = (await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope,
          account: mockAccountId,
          request: {
            method: 'eth_signUserOperation',
            params: [userOperation],
          },
        })) as { pending: false; result: string };

        const userOperationWithSignature = {
          ...userOperation,
          signature: operation.result,
        };

        expect(operation.result).toBe(expectedSignature);
        // Check if account with init code was deployed
        await entryPoint.handleOps(
          [userOperationWithSignature],
          aaAccount.address,
        );
        const accountCode = await provider.getCode(aaAccount.address);
        expect(accountCode).not.toBe('0x');
      });
    });
  });

  describe('#submitRequest', () => {
    beforeEach(async () => {
      await keyring.createAccount({ privateKey: aaOwnerSk });
    });

    it('should throw an error if the request method is not supported', async () => {
      const unsupportedMethod = 'unsupported-method';
      await expect(
        keyring.submitRequest({
          id: v4(),
          scope,
          account: mockAccountId,
          request: {
            method: unsupportedMethod,
            params: [],
          },
        }),
      ).rejects.toThrow(`EVM method '${unsupportedMethod}' not supported`);
    });

    it('should throw an error if the account does not exist', async () => {
      await expect(
        keyring.submitRequest({
          id: v4(),
          scope,
          account: nonExistentAccountId,
          request: {
            method: 'eth_signUserOperation',
            params: [],
          },
        }),
      ).rejects.toThrow(`Account '${nonExistentAccountId}' not found`);
    });

    describe('#getEntryPoint', () => {
      it('should throw an error if not on a supported chain', async () => {
        const aaAccount = await keyring.createAccount({
          privateKey: aaOwnerSk,
        });

        const unsupportedChainId = BigInt(11297108109);
        const mockedNetwork = {
          name: 'palm',
          chainId: unsupportedChainId,
          ensAddress: null,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _defaultProvider: () => null,
        };

        const getNetworkSpy = jest
          .spyOn(ethers.provider, 'getNetwork')
          .mockResolvedValue(mockedNetwork as any);

        const userOperation: EthUserOperation = {
          sender: aaAccount.address,
          nonce: '0x00',
          initCode: '0x',
          callData:
            '0xb61d27f600000000000000000000000097a0924bf222499cba5c29ea746e82f2307302930000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000',
          signature: '0x',
          paymasterAndData: '0x',
          callGasLimit: '0x58a83',
          verificationGasLimit: '0xe8c4',
          preVerificationGas: '0xc57c',
          maxFeePerGas: '0x11',
          maxPriorityFeePerGas: '0x11',
        };

        await expect(
          keyring.submitRequest({
            id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
            scope: toCaipChainId(
              CaipNamespaces.Eip155,
              unsupportedChainId.toString(),
            ),
            account: mockAccountId,
            request: {
              method: 'eth_signUserOperation',
              params: [userOperation],
            },
          }),
        ).rejects.toThrow(
          `Unsupported chain ID: ${unsupportedChainId.toString()}`,
        );

        getNetworkSpy.mockRestore();
      });
    });

    describe('Scope validation', () => {
      it('should throw an error if the scope is invalid', async () => {
        const invalidScope = 'foobarbazquz:1';
        const intent = {
          to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
          value: '0x00',
          data: ethers.ZeroHash,
        };
        await expect(
          keyring.submitRequest({
            id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
            scope: invalidScope,
            account: mockAccountId,
            request: {
              method: 'eth_prepareUserOperation',
              params: [intent],
            },
          }),
        ).rejects.toThrow(
          `[Snap] Error parsing request scope '${invalidScope}': Invalid CAIP chain ID.`,
        );
      });

      it('should throw an error if the scope does not match the current chain', async () => {
        const differentScope = toCaipChainId(CaipNamespaces.Eip155, '1');
        const intent = {
          to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
          value: '0x00',
          data: ethers.ZeroHash,
        };

        await expect(
          keyring.submitRequest({
            id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
            scope: differentScope,
            account: mockAccountId,
            request: {
              method: 'eth_prepareUserOperation',
              params: [intent],
            },
          }),
        ).rejects.toThrow(
          `[Snap] Chain ID '${chainId}' mismatch with scope '${differentScope}'`,
        );
      });

      it('should throw an error if the account does not support the scope', async () => {
        const mockedNetwork = {
          name: 'mainnet',
          chainId: BigInt(1),
          ensAddress: null,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _defaultProvider: () => null,
        };
        const getNetworkSpy = jest
          .spyOn(ethers.provider, 'getNetwork')
          .mockResolvedValue(mockedNetwork as any);

        await keyring.setConfig({
          simpleAccountFactory: await simpleAccountFactory.getAddress(),
          entryPoint: await entryPoint.getAddress(),
          customVerifyingPaymasterAddress:
            await verifyingPaymaster.getAddress(),
        });

        // Create an account for a different chain
        const aaAccount = await keyring.createAccount({
          privateKey: aaOwnerSk,
        });

        getNetworkSpy.mockRestore();

        const intent = {
          to: '0x97a0924bf222499cBa5C29eA746E82F230730293',
          value: '0x00',
          data: ethers.ZeroHash,
        };

        await expect(
          keyring.submitRequest({
            id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
            scope, // current chain
            account: aaAccount.id,
            request: {
              method: 'eth_prepareUserOperation',
              params: [intent],
            },
          }),
        ).rejects.toThrow(`[Snap] Account does not support chain: ${scope}`);
      });
    });
  });

  describe('togglePaymasterUsage', () => {
    it('toggles the use of the paymaster', async () => {
      expect(keyring.isUsingPaymaster()).toBe(false);
      await keyring.togglePaymasterUsage();
      expect(keyring.isUsingPaymaster()).toBe(true);
      await keyring.togglePaymasterUsage();
      expect(keyring.isUsingPaymaster()).toBe(false);
    });
  });
});
