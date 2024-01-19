import { stripHexPrefix } from '@ethereumjs/util';
import { ethers } from 'ethers';
import * as process from 'process';

export const DUMMY_SIGNATURE =
  '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c';

/**
 *
 * @param paymasterAddress
 */
function getDummyPaymasterAndData(paymasterAddress?: string): string {
  if (!paymasterAddress) {
    return '0x';
  }

  const encodedValidUntilAfter = stripHexPrefix(
    ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [0, 0]),
  );

  return `${paymasterAddress}${encodedValidUntilAfter}${stripHexPrefix(
    DUMMY_SIGNATURE,
  )}`;
}

export const DUMMY_PAYMASTER_AND_DATA = getDummyPaymasterAndData(
  process.env.PAYMASTER_ADDRESS ?? '',
);

export const DUMMY_GAS_VALUES = {
  callGasLimit: '0x58a83',
  verificationGasLimit: '0xe8c4',
  preVerificationGas: '0xc57c',
};
