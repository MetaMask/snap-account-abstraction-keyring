import { exactOptional } from '@metamask/keyring-api';
import type { Hex } from '@metamask/utils';
import { isValidHexAddress } from '@metamask/utils';
import { ethers } from 'ethers';
import { assert, define, object, StructError } from 'superstruct';

import { throwError } from './util';
import { CONFIG_ERROR_MESSAGES, CONFIG_KEYS } from '../constants/chainConfig';
import type { ChainConfig } from '../keyring';

const EthereumAddress = define(
  'EthereumAddress',
  (value) => typeof value === 'string' && isValidHexAddress(value as Hex),
);

const Url = define('Url', (value) => {
  const urlPattern =
    /^(https?:\/\/)?[\w.-]+(:\d{2,6})?(\/[\w.-]*)?(\?[\w.&=%-]*)?$/u;
  return typeof value === 'string' && urlPattern.test(value);
});

const PrivateKey = define('PrivateKey', (value) => {
  return typeof value === 'string' && ethers.isHexString(value);
});

const ChainConfigStruct = object({
  [CONFIG_KEYS.SIMPLE_ACCOUNT_FACTORY]: exactOptional(EthereumAddress),
  [CONFIG_KEYS.ENTRY_POINT]: exactOptional(EthereumAddress),
  [CONFIG_KEYS.BUNDLER_URL]: exactOptional(Url),
  [CONFIG_KEYS.CUSTOM_VERIFYING_PAYMASTER_ADDRESS]:
    exactOptional(EthereumAddress),
  [CONFIG_KEYS.CUSTOM_VERIFYING_PAYMASTER_PK]: exactOptional(PrivateKey),
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
      if (path.length === 0) {
        throwError(
          `[Snap] Chain configuration error: ${(error as Error).message}`,
        );
      }
      const fieldName = path[0];
      switch (fieldName) {
        case CONFIG_KEYS.SIMPLE_ACCOUNT_FACTORY:
          customMessage = `${
            CONFIG_ERROR_MESSAGES.INVALID_SIMPLE_ACCOUNT_FACTORY_ADDRESS
          } ${String(value)}`;
          break;
        case CONFIG_KEYS.ENTRY_POINT:
          customMessage = `${
            CONFIG_ERROR_MESSAGES.INVALID_ENTRY_POINT_ADDRESS
          } ${String(value)}`;
          break;
        case CONFIG_KEYS.BUNDLER_URL:
          customMessage = `${
            CONFIG_ERROR_MESSAGES.INVALID_BUNDLER_URL
          } ${String(value)}`;
          break;
        case CONFIG_KEYS.CUSTOM_VERIFYING_PAYMASTER_ADDRESS:
          customMessage = `${
            CONFIG_ERROR_MESSAGES.INVALID_CUSTOM_VERIFYING_PAYMASTER_ADDRESS
          } ${String(value)}`;
          break;
        case CONFIG_KEYS.CUSTOM_VERIFYING_PAYMASTER_PK:
          customMessage = `${
            CONFIG_ERROR_MESSAGES.INVALID_CUSTOM_VERIFYING_PAYMASTER_PK
          } ${String(value)}`;
          break;
        default:
          customMessage = `[Snap] Invalid chain configuration for ${String(
            fieldName,
          )}: ${String(value)}`;
          break;
      }
      throwError(customMessage);
    } else {
      throwError(
        `[Snap] Chain configuration error: ${(error as Error).message}`,
      );
    }
  }
}
