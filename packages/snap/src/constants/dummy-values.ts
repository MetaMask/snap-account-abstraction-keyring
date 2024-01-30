import { stripHexPrefix } from '@ethereumjs/util';
import { ethers } from 'ethers';

export const DUMMY_SIGNATURE =
  '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c';

/**
 * Get the dummy paymaster and data.
 *
 * @param paymasterAddress - The address of the paymaster.
 * @returns The dummy paymaster and data.
 */
export function getDummyPaymasterAndData(paymasterAddress?: string): string {
  if (!paymasterAddress) {
    return '0x';
  }

  const encodedValidUntilAfter = stripHexPrefix(
    ethers.utils.defaultAbiCoder.encode(['uint48', 'uint48'], [0, 0]),
  );

  return `${paymasterAddress}${encodedValidUntilAfter}${stripHexPrefix(
    DUMMY_SIGNATURE,
  )}`;
}

export const DUMMY_GAS_VALUES = {
  callGasLimit: '0x58a83',
  verificationGasLimit: '0xe8c4',
  preVerificationGas: '0xc57c',
};
