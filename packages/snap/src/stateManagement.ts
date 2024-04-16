import { ManageStateOperation } from '@metamask/snaps-sdk';

import { DEFAULT_AA_FACTORIES } from './constants/aa-factories';
import { CHAIN_IDS } from './constants/chain-ids';
import { DEFAULT_ENTRYPOINTS } from './constants/entrypoints';
import type { KeyringState } from './keyring';
import { logger } from './logger';

/**
 * Default keyring state.
 */
const defaultState: KeyringState = {
  wallets: {},
  config: {
    [CHAIN_IDS.AVALANCHE_FUJI]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.AVALANCHE_FUJI] ?? '',
      entryPoint: DEFAULT_ENTRYPOINTS[CHAIN_IDS.AVALANCHE_FUJI]?.address ?? '',
    },
    [CHAIN_IDS.CELO_ALFAJORES]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.CELO_ALFAJORES] ?? '',
      entryPoint: DEFAULT_ENTRYPOINTS[CHAIN_IDS.CELO_ALFAJORES]?.address ?? '',
    },
    [CHAIN_IDS.ARBITRUM_SEPOLIA]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.ARBITRUM_SEPOLIA] ?? '',
      entryPoint:
        DEFAULT_ENTRYPOINTS[CHAIN_IDS.ARBITRUM_SEPOLIA]?.address ?? '',
    },
    [CHAIN_IDS.OPTMIISM_SEPOLIA]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.OPTMIISM_SEPOLIA] ?? '',
      entryPoint:
        DEFAULT_ENTRYPOINTS[CHAIN_IDS.OPTMIISM_SEPOLIA]?.address ?? '',
    },
    [CHAIN_IDS.LINEA_GOERLI]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.LINEA_GOERLI] ?? '',
      entryPoint: DEFAULT_ENTRYPOINTS[CHAIN_IDS.LINEA_GOERLI]?.address ?? '',
    },
    [CHAIN_IDS.POLYGON_MUMBAI]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.POLYGON_MUMBAI] ?? '',
      entryPoint: DEFAULT_ENTRYPOINTS[CHAIN_IDS.POLYGON_MUMBAI]?.address ?? '',
    },
    [CHAIN_IDS.SEPOLIA]: {
      simpleAccountFactory:
        DEFAULT_AA_FACTORIES['0.6.0']?.[CHAIN_IDS.SEPOLIA] ?? '',
      entryPoint: DEFAULT_ENTRYPOINTS[CHAIN_IDS.SEPOLIA]?.address ?? '',
    },
  },
  usePaymaster: false,
};

/**
 * Retrieves the current state of the keyring.
 *
 * @returns The current state of the keyring.
 */
export async function getState(): Promise<KeyringState> {
  const state = (await snap.request({
    method: 'snap_manageState',
    params: { operation: ManageStateOperation.GetState },
  })) as any;

  if (!state) {
    return defaultState;
  }

  return state;
}

/**
 * Persists the given snap state.
 *
 * @param state - New snap state.
 */
export async function saveState(state: KeyringState) {
  await snap.request({
    method: 'snap_manageState',
    params: { operation: ManageStateOperation.UpdateState, newState: state },
  });
}
