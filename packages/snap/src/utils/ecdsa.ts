import type { EthUserOperation } from '@metamask/keyring-api';
import { ethers } from 'ethers';

/**
 * Get the hash of a user operation.
 *
 * @param userOperation - The user operation.
 * @param entrypointAddress - The entrypoint address.
 * @param chainId - The chain ID.
 * @returns The hash of the user operation.
 */
export function getUserOperationHash(
  userOperation: EthUserOperation,
  entrypointAddress: string,
  chainId: string,
): string {
  const chainIdDecimal = parseInt(chainId, 10);
  const hash = ethers.utils.keccak256(encodeUserOperation(userOperation));

  const data = ethers.utils.defaultAbiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [hash, entrypointAddress, chainIdDecimal],
  );

  return ethers.utils.keccak256(data);
}

/**
 * Encode the user operation.
 *
 * @param userOperation - The user operation.
 * @returns The encoded user operation.
 */
function encodeUserOperation(userOperation: EthUserOperation): string {
  return ethers.utils.defaultAbiCoder.encode(
    [
      'address',
      'uint256',
      'bytes32',
      'bytes32',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'bytes32',
    ],
    [
      userOperation.sender,
      userOperation.nonce,
      ethers.utils.keccak256(userOperation.initCode),
      ethers.utils.keccak256(userOperation.callData),
      userOperation.callGasLimit,
      userOperation.verificationGasLimit,
      userOperation.preVerificationGas,
      userOperation.maxFeePerGas,
      userOperation.maxPriorityFeePerGas,
      ethers.utils.keccak256(userOperation.paymasterAndData),
    ],
  );
}
