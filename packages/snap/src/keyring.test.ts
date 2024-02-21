/* eslint-disable camelcase */
/* eslint-disable n/no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { stripHexPrefix } from '@ethereumjs/util';
import type {
  EthBaseUserOperation,
  EthUserOperation,
  KeyringAccount,
  KeyringRequest,
} from '@metamask/keyring-api';
import { EthMethod } from '@metamask/keyring-api';
import type { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { v4 } from 'uuid';

import {
  DUMMY_SIGNATURE,
  getDummyPaymasterAndData,
} from './constants/dummy-values';
import type { ChainConfig } from './keyring';
import { AccountAbstractionKeyring } from './keyring';
import { InternalMethod } from './permissions';
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
import { getUserOperationHash } from './utils/ecdsa';
import { provider } from './utils/ethers';

const mockAccountId = 'ea747116-767c-4117-a347-0c3f7b19cc5a';
const TEST_MNEMONIC =
  'test test test test test test test test test test test junk';
const chainId = '11155111';
let accountCreationCount = 0;

// This mocks the ethereum global object thats available in the Snaps Execution Environment
jest.mock('../src/utils/ethers', () => ({
  ...jest.requireActual('hardhat'),
  provider: ethers.provider,
  getSigner: (privateKey: string) =>
    new ethers.Wallet(privateKey, ethers.provider),
}));

jest.mock('uuid', () => {
  return {
    v4: () => {
      accountCreationCount++;
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

const getInitialState = () => ({
  wallets: {},
  config: {},
});

const aaAccountInterface = new SimpleAccount__factory();
const simpleAccountFactoryInterface = new SimpleAccountFactory__factory();

describe('Keyring', () => {
  let aaOwner: Signer;
  let aaOwnerPk: string;
  let keyring: AccountAbstractionKeyring;
  let simpleAccountFactory: SimpleAccountFactory;
  let entryPoint: EntryPoint;
  let verifyingPaymaster: VerifyingPaymaster;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    aaOwner = signers[0]!;
    aaOwnerPk = ethers.Wallet.fromPhrase(TEST_MNEMONIC).privateKey;
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
    });

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
        customVerifyingPaymasterPK: aaOwnerPk,
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
        value: 'https:/invalid.fake.io',
        errorMessage: 'Invalid Bundler URL',
      },
      {
        field: 'customVerifyingPaymasterPK',
        value: '123NotAPrivateKey456',
        errorMessage: 'Invalid Custom Verifying Paymaster Private Key',
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
      const account = await keyring.createAccount({ privateKey: aaOwnerPk });
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
        privateKey: aaOwnerPk,
        salt,
      });
      expect(account).toBeDefined();
      expect(await keyring.getAccount(account.id)).toStrictEqual(account);
      expect(account.address).toBe(expectedAddressFromSalt);
      const accountFromDifferentSalt = await keyring.createAccount({
        privateKey: aaOwnerPk,
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
        privateKey: aaOwnerPk,
        salt,
      });
      expect(account).toBeDefined();
      expect(await keyring.getAccount(account.id)).toStrictEqual(account);
      expect(account.address).toBe(expectedAddressFromSalt);
      await expect(
        keyring.createAccount({ privateKey: aaOwnerPk, salt }),
      ).rejects.toThrow(
        `[Snap] Account abstraction address already in use: ${expectedAddressFromSalt}`,
      );
    });

    it('should not create an account with an invalid private key', async () => {
      const invalidPrivateKey = '123NotAPrivateKey456';
      await expect(
        keyring.createAccount({ privateKey: invalidPrivateKey }),
      ).rejects.toThrow(`Invalid private key`);
    });

    it('should throw an error when saving state fails', async () => {
      jest
        .spyOn(stateManagement, 'saveState')
        .mockImplementationOnce(async () => {
          throw new Error('Failed to save state');
        });
      await expect(
        keyring.createAccount({ privateKey: aaOwnerPk }),
      ).rejects.toThrow('Failed to save state');
    });
  });

  describe('List Accounts', () => {
    it('should list the created accounts', async () => {
      const account1 = await keyring.createAccount({
        privateKey: aaOwnerPk,
        salt: '0x123',
      });
      const account2 = await keyring.createAccount({
        privateKey: aaOwnerPk,
        salt: '0x456',
      });
      const account3 = await keyring.createAccount({
        privateKey: aaOwnerPk,
        salt: '0x789',
      });

      const accounts = await keyring.listAccounts();
      expect(accounts).toStrictEqual([account1, account2, account3]);
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

      expect(filteredChains).toEqual(expectedFilteredChains);
    });
  });

  describe('Update Account', () => {
    let aaAccount: KeyringAccount;

    beforeEach(async () => {
      aaAccount = await keyring.createAccount({ privateKey: aaOwnerPk });
    });

    it('should update an account', async () => {
      const updatedAccount = { ...aaAccount, options: { updated: true } };
      await keyring.updateAccount(updatedAccount);
      const storedAccount = await keyring.getAccount(aaAccount.id);
      expect(storedAccount.options.updated).toBe(true);
    });

    it('should throw an error when trying to update a non-existent account', async () => {
      const nonExistentAccount: KeyringAccount = {
        id: 'non-existent-id',
        options: {
          updated: true,
        },
        type: 'eip155:eoa',
        address: aaAccount.address,
        methods: aaAccount.methods,
      };
      await expect(keyring.updateAccount(nonExistentAccount)).rejects.toThrow(
        `Account 'non-existent-id' not found`,
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
      jest
        .spyOn(stateManagement, 'saveState')
        .mockImplementationOnce(async () => {
          throw new Error('Failed to save state');
        });
      await expect(
        keyring.updateAccount({
          ...aaAccount,
          options: { updated: true },
        }),
      ).rejects.toThrow('Failed to save state');
    });
  });

  describe('Delete Account', () => {
    it('should delete an account', async () => {
      const account = await keyring.createAccount({ privateKey: aaOwnerPk });
      await keyring.deleteAccount(account.id);
      await expect(keyring.getAccount(account.id)).rejects.toThrow(
        `Account '${account.id}' not found`,
      );
      expect(await keyring.listAccounts()).toStrictEqual([]);
    });

    it('should not throw an error when trying to delete a non-existent account', async () => {
      await expect(
        keyring.deleteAccount('non-existent-id'),
      ).resolves.toBeUndefined();
    });

    it('should throw an error when saving state fails', async () => {
      jest
        .spyOn(stateManagement, 'saveState')
        .mockImplementationOnce(async () => {
          throw new Error('Failed to save state');
        });
      await expect(keyring.deleteAccount(mockAccountId)).rejects.toThrow(
        'Failed to save state',
      );
    });
  });

  describe('UserOperations Methods', () => {
    let aaAccount: KeyringAccount;
    let initCode: string;
    const salt = '0x123';

    beforeEach(async () => {
      aaAccount = await keyring.createAccount({
        privateKey: aaOwnerPk,
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
          scope: '',
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
          scope: '',
          account: mockAccountId,
          request: {
            method: 'eth_prepareUserOperation',
            params: [intent],
          },
        })) as { pending: false; result: EthBaseUserOperation };

        expect(op).toStrictEqual(expected);
        expect(op.result.initCode).toBe(initCode);
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
          scope: '',
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
          scope: '',
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
          scope: '',
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
      await keyring.createAccount({ privateKey: aaOwnerPk });
    });

    it('should throw an error if the request method is not supported', async () => {
      const unsupportedMethod = 'unsupported-method';
      await expect(
        keyring.submitRequest({
          id: v4(),
          scope: '',
          account: mockAccountId,
          request: {
            method: unsupportedMethod,
            params: [],
          },
        }),
      ).rejects.toThrow(`EVM method '${unsupportedMethod}' not supported`);
    });

    it('should throw an error if the account does not exist', async () => {
      const accountId = 'non-existent-id';
      await expect(
        keyring.submitRequest({
          id: v4(),
          scope: '',
          account: accountId,
          request: {
            method: 'eth_signUserOperation',
            params: [],
          },
        }),
      ).rejects.toThrow(`Account '${accountId}' not found`);
    });

    it('should return the result of setting the config when submitting a set config request', async () => {
      const mockConfig: ChainConfig = {
        simpleAccountFactory: '0x07a4E8982B685EC9d706FbF21459e159A141Cfe7',
        entryPoint: '0x15FC356a6bd6b9915322A43327B9Cc5477568e99',
        bundlerUrl: 'https://example.com/bundler',
        customVerifyingPaymasterPK:
          '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        customVerifyingPaymasterAddress:
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      };

      const requestId = v4();
      const request: KeyringRequest = {
        id: requestId,
        scope: '',
        account: mockAccountId,
        request: {
          method: InternalMethod.SetConfig,
          params: [mockConfig],
        },
      };

      const response = await keyring.submitRequest(request);
      expect(response).toEqual({ pending: false, result: mockConfig });
    });
  });
});
