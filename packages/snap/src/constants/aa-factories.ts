import { CHAIN_IDS } from './chain-ids';

export type EntryPointVersion = string;

export type AAFactoryInfo = Record<keyof typeof CHAIN_IDS, string>;

export const DEFAULT_AA_FACTORIES: Record<EntryPointVersion, AAFactoryInfo> = {
  // @ts-expect-error will deploy to other networks later
  '0.6.0': {
    // TESTNETS
    [CHAIN_IDS.SEPOLIA]: '0xBfc0acf30682F2d1A8594B61100b6ccb64302c05',
  },
};
