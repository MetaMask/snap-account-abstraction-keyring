import snapPackageInfo from '../../../snap/package.json';
import type { ChainConfig, ChainConfigs } from '../components/ChainConfig';
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
 * Invokes a Snap method with the specified parameters.
 * @param method - The method to invoke.
 * @param params - Optional parameters for the method.
 * @returns A promise that resolves to the result of the Snap method invocation.
 */
const walletInvokeSnap = async (method: string, params: JSON = {} as JSON) => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method, params },
    },
  });
};

/**
 * Toggle paymaster usage.
 */
export const togglePaymasterUsage = async () => {
  await walletInvokeSnap('snap.internal.togglePaymasterUsage');
};

export const isUsingPaymaster = async (): Promise<boolean> => {
  return (await walletInvokeSnap('snap.internal.isUsingPaymaster')) as boolean;
};

/**
 * Checks if the current chain is configured by retrieving the chain ID from the Ethereum provider and
 * comparing it with the chain configurations obtained from the wallet's Snap plugin.
 * @returns A promise that resolves to a boolean indicating whether the current chain is configured.
 */
export const isCurrentChainConfigured = async (): Promise<boolean> => {
  const currentChainId = (await window.ethereum.request({
    method: 'eth_chainId',
  })) as string;
  const configs = (await walletInvokeSnap('snap.getConfigs')) as ChainConfigs;

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

export const getChainConfigs = async (): Promise<ChainConfigs> => {
  return (await walletInvokeSnap('snap.internal.getConfigs')) as ChainConfigs;
};

export const saveChainConfig = async ({
  chainId,
  chainConfig,
}: {
  chainId: string;
  chainConfig: Partial<ChainConfig>;
}): Promise<void> => {
  if (!chainId) {
    throw new Error('Invalid parameters');
  }

  const configs = await getChainConfigs();

  if (!configs[chainId]) {
    throw new Error('Invalid chain ID');
  }

  await walletInvokeSnap('snap.internal.setConfig', chainConfig as JSON);
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
