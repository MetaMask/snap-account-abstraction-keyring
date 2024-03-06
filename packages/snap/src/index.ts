import {
  MethodNotSupportedError,
  handleKeyringRequest,
} from '@metamask/keyring-api';
import type {
  OnKeyringRequestHandler,
  OnRpcRequestHandler,
} from '@metamask/snaps-sdk';

import type { ChainConfig } from './keyring';
import { AccountAbstractionKeyring } from './keyring';
import { logger } from './logger';
import { InternalMethod, originPermissions } from './permissions';
import { getState } from './stateManagement';

let keyring: AccountAbstractionKeyring;

/**
 * Return the keyring instance. If it doesn't exist, create it.
 */
async function getKeyring(): Promise<AccountAbstractionKeyring> {
  if (!keyring) {
    const state = await getState();
    if (!keyring) {
      keyring = new AccountAbstractionKeyring(state);
    }
  }
  return keyring;
}

/**
 * Verify if the caller can call the requested method.
 *
 * @param origin - Caller origin.
 * @param method - Method being called.
 * @returns True if the caller is allowed to call the method, false otherwise.
 */
function hasPermission(origin: string, method: string): boolean {
  return originPermissions.get(origin)?.includes(method) ?? false;
}

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  logger.debug(
    `RPC request (origin="${origin}"):`,
    JSON.stringify(request, undefined, 2),
  );

  // Check if origin is allowed to call method.
  if (!hasPermission(origin, request.method)) {
    throw new Error(
      `Origin '${origin}' is not allowed to call '${request.method}'`,
    );
  }

  // Handle custom methods.
  switch (request.method) {
    case InternalMethod.SetConfig: {
      if (!request.params?.length) {
        throw new Error('Missing config');
      }
      return (await getKeyring()).setConfig(request.params as ChainConfig);
    }

    case InternalMethod.GetConfigs: {
      return (await getKeyring()).getConfigs();
    }

    default: {
      throw new MethodNotSupportedError(request.method);
    }
  }
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TODO: fix types
export const onKeyringRequest: OnKeyringRequestHandler = async ({
  origin,
  request,
}) => {
  logger.debug(
    `Keyring request (origin="${origin}"):`,
    JSON.stringify(request, undefined, 2),
  );

  // Check if origin is allowed to call method.
  if (!hasPermission(origin, request.method)) {
    throw new Error(
      `Origin '${origin}' is not allowed to call '${request.method}'`,
    );
  }

  // Handle keyring methods.
  return handleKeyringRequest(await getKeyring(), request);
};
