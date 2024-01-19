/* eslint-disable camelcase */
/* eslint-disable n/no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { stripHexPrefix } from '@ethereumjs/util';
import type { EthUserOperation, KeyringAccount } from '@metamask/keyring-api';
import type { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { DUMMY_SIGNATURE } from './constants/dummy-values';
import type { ChainConfig, KeyringState } from './keyring';
import { AccountAbstractionKeyring } from './keyring';
import { SimpleAccount__factory, VerifyingPaymaster__factory } from './types';
import { getUserOperationHash } from './utils/ecdsa';

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
    it('should set the config', async () => {
      const config: ChainConfig = {
        simpleAccountFactory: '0x97a0924bf222499cBa5C29eA746E82F230730293',
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        bundlerUrl: 'https://bundler.example.com/rpc',
        customVerifyingPaymasterPK: 'abcd1234qwer5678tyui9012ghjk3456zxcv7890',
        customVerifyingPaymasterAddress:
          '0x123456789ABCDEF0123456789ABCDEF012345678',
      };
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

    beforeEach(async () => {
      aaAccount = await keyring.createAccount({ privateKey: aaOwnerPk });
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
            dummyPaymasterAndData:
              '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
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

        const expectedSignature = await aaOwner.signMessage(userOpHash);

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
    });
  });
});
