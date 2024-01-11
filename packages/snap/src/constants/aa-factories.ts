import type { Wallet } from 'ethers';

import { CHAIN_IDS } from './chain-ids';
// eslint-disable-next-line camelcase
import { SimpleAccountFactory__factory } from '../types';
import { throwError } from '../utils/util';

export type AAFactoryInfo = {
  version: number;
  address: string;
};

export const DEFAULT_AA_FACTORIES: Record<number, AAFactoryInfo> = {
  [CHAIN_IDS.ETHEREUM]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
  [CHAIN_IDS.POLYGON]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
  [CHAIN_IDS.OPTIMISM]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
  [CHAIN_IDS.AVALANCHE]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
  [CHAIN_IDS.ARBITRUM]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },

  // TESTNETS
  [CHAIN_IDS.POLYGON_MUMBAI]: {
    version: 0.6,
    address: '0xB73Ea064F1271f60e811847d2d2203036Ae74757',
  },
  [CHAIN_IDS.OPTMIISM_GOERLI]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
  [CHAIN_IDS.AVALANCHE_FUJI]: {
    version: 0.6,
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
};

/**
 * Returns the default AA factory for the given chain ID.
 *
 * @param chainId - The chain ID.
 * @param signer - The signer to use.
 * @returns The AA factory.
 */
export async function getAAFactory(chainId: number, signer: Wallet) {
  const factoryAddress =
    DEFAULT_AA_FACTORIES[chainId]?.address ??
    throwError(`[Snap] Unknown factory address for chain ${chainId}`);
  // get factory contract by chain
  // eslint-disable-next-line camelcase
  return SimpleAccountFactory__factory.connect(factoryAddress, signer);
}
