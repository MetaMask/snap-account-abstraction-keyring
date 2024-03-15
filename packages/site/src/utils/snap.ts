import snapPackageInfo from '../../../snap/package.json';
import type { ChainConfigs } from '../components/ChainConfig';
import { defaultSnapOrigin } from '../config';
import type { GetSnapsResponse, Snap } from '../types';

/**
 * Get the installed snaps in MetaMask.
 *
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await window.ethereum.request({
    method: 'wallet_getSnaps',
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 *
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = defaultSnapOrigin,
  params: Record<'version' | string, unknown> = {
    version: snapPackageInfo.version,
  },
) => {
  await window.ethereum.request({
    method: 'wallet_requestSnaps',
    params: {
      [snapId]: params,
    },
  });
};

/**
 * Get the snap from MetaMask.
 *
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (version?: string): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) =>
        snap.id === defaultSnapOrigin && (!version || snap.version === version),
    );
  } catch (error) {
    console.log('Failed to obtain installed snap', error);
    return undefined;
  }
};

/**
 * Invoke the "hello" method from the example snap.
 */

export const sendHello = async () => {
  await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'snap.internal.hello' },
    },
  });
};

/**
 * Toggle paymaster usage.
 */

export const togglePaymasterUsage = async () => {
  await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'snap.internal.togglePaymasterUsage' },
    },
  });
};

export const isUsingPaymaster = async (): Promise<boolean> => {
  return (await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'snap.internal.isUsingPaymaster' },
    },
  })) as boolean;
};

export const isCurrentChainConfigured = async (): Promise<boolean> => {
  const currentChainId = (await window.ethereum.request({
    method: 'eth_chainId',
  })) as string;
  const configs = (await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'snap.getConfigs' },
    },
  })) as ChainConfigs;

  const chainConfig = configs[currentChainId];

  if (!chainConfig) {
    return false;
  }

  return (
    chainConfig.simpleAccountFactory !== '' &&
    chainConfig.entryPoint !== '' &&
    chainConfig.bundlerUrl !== ''
  );
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
