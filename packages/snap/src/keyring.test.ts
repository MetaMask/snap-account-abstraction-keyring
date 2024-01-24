/* eslint-disable camelcase */
/* eslint-disable n/no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { stripHexPrefix } from '@ethereumjs/util';
import type {
  EthBaseUserOperation,
  EthUserOperation,
  KeyringAccount,
} from '@metamask/keyring-api';
import type { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { DUMMY_SIGNATURE } from './constants/dummy-values';
import type { ChainConfig, KeyringState } from './keyring';
import { AccountAbstractionKeyring } from './keyring';
import {
  EntryPoint__factory,
  SimpleAccount__factory,
  VerifyingPaymaster__factory,
} from './types';
import { getUserOperationHash } from './utils/ecdsa';
import { provider } from './utils/ethers';

const mockAccountId = 'ea747116-767c-4117-a347-0c3f7b19cc5a';
const entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const chainId = '11155111';

// This mocks the ethereum global object thats available in the Snaps Execution Environment
jest.mock('../src/utils/ethers', () => ({
  ...jest.requireActual('hardhat'),
  provider: ethers.provider,
  getSigner: (privateKey: string) =>
    new ethers.Wallet(privateKey, ethers.provider),
}));

jest.mock('uuid', () => ({
  v4: () => mockAccountId,
}));

// @ts-expect-error Mocking Snap global object
global.snap = {
  request: jest.fn(),
  emitEvent: jest.fn(),
};

const defaultState: KeyringState = {
  wallets: {},
  pendingRequests: {},
  config: {},
};

const aaAccountInterface = new SimpleAccount__factory();

describe('Keyring', () => {
  let aaOwner: Signer;
  let aaOwnerPk: string;
  let keyring: AccountAbstractionKeyring;

  beforeAll(async () => {
    const signers = await ethers.getSigners();
    aaOwner = signers[0]!;
    aaOwnerPk = ethers.Wallet.fromPhrase(process.env.MNEMONIC!).privateKey;

    keyring = new AccountAbstractionKeyring(defaultState);
  });

  describe('Constructor', () => {
    it('should create a new keyring with default state', async () => {
      expect(keyring).toBeDefined();
      expect(await keyring.listAccounts()).toStrictEqual([]);
      expect(await keyring.listRequests()).toStrictEqual([]);
    });
  });

  describe('Set Config', () => {
    const config: ChainConfig = {
      simpleAccountFactory: '0x97a0924bf222499cBa5C29eA746E82F230730293',
      entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      bundlerUrl: 'https://bundler.example.com/rpc',
      customVerifyingPaymasterPK: aaOwnerPk,
      customVerifyingPaymasterAddress:
        '0x123456789ABCDEF0123456789ABCDEF012345678',
    };
    it('should not set the config without a valid config', async () => {
      const invalidConfig: ChainConfig = {
        ...config,
        simpleAccountFactory: '0xNotAnAddress',
      };
      await expect(keyring.setConfig(invalidConfig)).rejects.toThrow(
        `[Snap] Invalid Simple Account Factory Address: ${invalidConfig.simpleAccountFactory}`,
      );
      invalidConfig.simpleAccountFactory = config.simpleAccountFactory!;
      invalidConfig.entryPoint = '0xNotAnAddress';
      await expect(keyring.setConfig(invalidConfig)).rejects.toThrow(
        `[Snap] Invalid EntryPoint Address: ${invalidConfig.entryPoint}`,
      );
      invalidConfig.entryPoint = config.entryPoint!;
      invalidConfig.customVerifyingPaymasterAddress = '0xNotAnAddress';
      await expect(keyring.setConfig(invalidConfig)).rejects.toThrow(
        `[Snap] Invalid Verifying Paymaster Address: ${invalidConfig.customVerifyingPaymasterAddress}`,
      );
      invalidConfig.customVerifyingPaymasterAddress =
        config.customVerifyingPaymasterAddress!;
      invalidConfig.bundlerUrl = 'https:/invalid.fake.io';
      await expect(keyring.setConfig(invalidConfig)).rejects.toThrow(
        `[Snap] Invalid Bundler URL: ${invalidConfig.bundlerUrl}`,
      );
      invalidConfig.bundlerUrl = config.bundlerUrl!;
      invalidConfig.customVerifyingPaymasterPK = '123NotAPrivateKey456';
      await expect(keyring.setConfig(invalidConfig)).rejects.toThrow(
        `[Snap] Invalid Verifying Paymaster Private Key`,
      );
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
      const expectedAddressFromSalt =
        '0x7b3d94f00b07a74e82571034c750E67637D9cC87';
      const account = await keyring.createAccount({
        privateKey: aaOwnerPk,
        salt: '0x123',
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
  });

  describe('UserOperations Methods', () => {
    let aaAccount: KeyringAccount;
    const initCode =
      '0xbfc0acf30682f2d1a8594b61100b6ccb64302c055fbfb9cf000000000000000000000000da1d3f95b7c67d9103d30c4437610437a137d8910000000000000000000000000000000000000000000000000000000000000123';

    beforeEach(async () => {
      aaAccount = await keyring.createAccount({
        privateKey: aaOwnerPk,
        salt: '0x123',
      });
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
            dummyPaymasterAndData: '0x',
            bundlerUrl: expect.any(String),
            gasLimits: {
              callGasLimit: '0x58a83',
              verificationGasLimit: '0xe8c4',
              preVerificationGas: '0xc57c',
            },
          },
        };

        const op = await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope: '',
          account: mockAccountId,
          request: {
            method: 'eth_prepareUserOperation',
            params: [[intent]],
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
            dummyPaymasterAndData: '0x',
            bundlerUrl: expect.any(String),
            gasLimits: {
              callGasLimit: '0x58a83',
              verificationGasLimit: '0xe8c4',
              preVerificationGas: '0xc57c',
            },
          },
        };

        const op = (await keyring.submitRequest({
          id: 'ef70fc30-93a8-4bb0-b8c7-9d3e7732372b',
          scope: '',
          account: mockAccountId,
          request: {
            method: 'eth_prepareUserOperation',
            params: [[intent]],
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

        const verifyingPaymaster = VerifyingPaymaster__factory.connect(
          process.env.VERIFYING_PAYMASTER_ADDRESS!,
          ethers.provider,
        );

        const hash = await verifyingPaymaster.getHash(userOperation, 0, 0);
        const expectedSignature = await aaOwner.signMessage(hash);
        const expectedPaymasterAndData =
          hash +
          stripHexPrefix(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['uint48', 'uint48'],
              [0, 0],
            ),
          ) +
          stripHexPrefix(expectedSignature);

        console.log(expectedPaymasterAndData);

        expect(operation.result.paymasterAndData).toBe(
          expectedPaymasterAndData,
        );

        const userOperationWithPaymasterAndData = {
          ...userOperation,
          paymasterAndData: operation.result.paymasterAndData,
        };

        expect(
          await verifyingPaymaster.validatePaymasterUserOp.staticCall(
            userOperationWithPaymasterAndData,
            '0x'.padEnd(66, '0'),
            100,
            { from: entryPoint },
          ),
        ).toHaveReturned();
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
          entryPoint,
          chainId,
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

      it('should sign a user operation with init code', async () => {
        const userOperation: EthUserOperation = {
          sender: aaAccount.address,
          nonce: '0x00',
          initCode,
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
          entryPoint,
          chainId,
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

        const entryPoint = EntryPoint__factory.connect();
        // Check if account with init code was deployed
        const accountCode = await provider.getCode(aaAccount.address);
        expect(accountCode).not.toBe('0x');
      });
    });
  });
});
