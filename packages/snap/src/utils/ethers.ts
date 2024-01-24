import { ethers } from 'ethers';

import { throwError } from './util';
import { logger } from '../logger';

export const provider = new ethers.BrowserProvider(ethereum);

/**
 * Returns a signer object from the given private key.
 *
 * @param privateKey - The private key to use for signing.
 * @returns The signer object.
 */
export function getSigner(privateKey: string): ethers.Wallet {
  let signer;
  try {
    signer = new ethers.Wallet(privateKey, provider);
  } catch (error: any) {
    logger.error(`[Snap] Invalid Private Key`);
    throwError(error.message);
  }
  return signer;
}
