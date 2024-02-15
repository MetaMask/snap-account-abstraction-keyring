import { ethers } from 'ethers';
import type { ChainConfig } from 'src/keyring';
import { assert, define, object, optional, StructError } from 'superstruct';

import { throwError } from './util';

const EthereumAddress = define(
  'EthereumAddress',
  (value) => typeof value === 'string' && ethers.isAddress(value),
);

const Url = define('Url', (value) => {
  const urlPattern =
    /^(https?:\/\/)?[\w\\.-]+(:\d{2,6})?(\/[\\/\w \\.-]*)?(\?[\\/\w .\-=]*)?$/u;
  return typeof value === 'string' && urlPattern.test(value);
});

const PrivateKey = define('PrivateKey', (value) => {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    new ethers.Wallet(value);
    return true;
  } catch {
    return false;
  }
});

const ChainConfigStruct = object({
  simpleAccountFactory: optional(EthereumAddress),
  entryPoint: optional(EthereumAddress),
  bundlerUrl: optional(Url),
  customVerifyingPaymasterAddress: optional(EthereumAddress),
  customVerifyingPaymasterPK: optional(PrivateKey),
});

/**
 * Validate the chain configuration.
 *
 * @param config - The chain configuration.
 * @throws If the configuration is invalid.
 */
export function validateConfig(config: ChainConfig): void {
  try {
    assert(config, ChainConfigStruct);
  } catch (error) {
    if (error instanceof StructError) {
      let customMessage = `[Snap] Invalid chain configuration: ${error.message}`;
      const { path, value } = error;
      if (path.length > 0) {
        const fieldName = path[0];
        switch (fieldName) {
          case 'simpleAccountFactory':
            customMessage = `[Snap] Invalid Simple Account Factory Address: ${value}`;
            break;
          case 'entryPoint':
            customMessage = `[Snap] Invalid Entry Point Address: ${value}`;
            break;
          case 'bundlerUrl':
            customMessage = `[Snap] Invalid Bundler URL: ${value}`;
            break;
          case 'customVerifyingPaymasterAddress':
            customMessage = `[Snap] Invalid Custom Verifying Paymaster Address: ${value}`;
            break;
          case 'customVerifyingPaymasterPK':
            customMessage = `[Snap] Invalid Custom Verifying Paymaster Private Key: ${value}`;
            break;
          default:
            break;
        }
      }
      throwError(customMessage);
    } else {
      throwError(
        `[Snap] Chain configuration error: ${(error as Error).message}`,
      );
    }
  }
}
