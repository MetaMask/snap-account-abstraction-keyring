import { ethers } from 'ethers';
import type { ChainConfig } from 'src/keyring';

import { throwError } from './util';

/**
 * Validate the chain configuration.
 *
 * @param config - The chain configuration.
 * @throws If the configuration is invalid.
 */
export function validateConfig(config: ChainConfig): void {
  validateAddress(
    config.simpleAccountFactory,
    'Simple Account Factory Address',
  );
  validateAddress(config.entryPoint, 'Entry Point Address');
  validateAddress(
    config.customVerifyingPaymasterAddress,
    'Custom Verifying Paymaster Address',
  );
  validateUrl(config.bundlerUrl, 'Bundler URL');
  validatePrivateKey(
    config.customVerifyingPaymasterPK,
    'Custom Verifying Paymaster Private Key',
  );
}

/**
 * Validates an address.
 *
 * @param address - The address to validate.
 * @param name - The name of the address (used in the error message).
 */
export function validateAddress(address?: string, name = 'Address'): void {
  if (address && !ethers.isAddress(address)) {
    throwError(`[Snap] Invalid ${name}: ${String(address)}`);
  }
}

/**
 * Validates a URL.
 *
 * @param url - The URL to validate.
 * @param name - The name of the URL (used in the error message).
 */
export function validateUrl(url?: string, name = 'URL'): void {
  const bundlerUrlRegex =
    /^(https?:\/\/)?[\w\\.-]+(:\d{2,6})?(\/[\\/\w \\.-]*)?(\?[\\/\w .\-=]*)?$/u;
  if (url && !bundlerUrlRegex.test(url)) {
    throwError(`[Snap] Invalid ${name}: ${url}`);
  }
}

/**
 * Validates a private key.
 *
 * @param pk - The private key to validate.
 * @param name - The name of the private key (used in the error message).
 */
export function validatePrivateKey(pk?: string, name = 'Private Key'): void {
  if (pk) {
    try {
      // eslint-disable-next-line no-new -- doing this to validate the pk
      new ethers.Wallet(pk);
    } catch (error) {
      throwError(`[Snap] Invalid ${name}: ${(error as Error).message}`);
    }
  }
}
