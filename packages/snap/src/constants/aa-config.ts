import { CHAIN_IDS } from './chain-ids';

export const AA_CONFIG = {
  [CHAIN_IDS.BOBA_ETH]: {
    version: '0.6.0',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    simpleAccountFactory: '0x9406cc6185a346906296840746125a0e44976454',
    bobaPaymaster: '0x',
    bobaToken: '0xa18bF3994C0Cc6E3b63ac420308E5383f53120D7',
    bundlerUrl: '',
  },
  // TESTNETS
  [CHAIN_IDS.SEPOLIA]: {
    version: '0.6.0',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    simpleAccountFactory: '0x9406cc6185a346906296840746125a0e44976454',
    bobaPaymaster: '0x0ebB672Aec2b82108542E29875669770EBcB7066',
    bobaToken: '0x33faF65b3DfcC6A1FccaD4531D9ce518F0FDc896',
    bundlerUrl: 'https://public.stackup.sh/api/v1/node/ethereum-sepolia',
  },
  [CHAIN_IDS.BOBA_SEPOLIA]: {
    version: '0.6.0',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    simpleAccountFactory: '0x9406cc6185a346906296840746125a0e44976454',
    bobaPaymaster: '0x8223388f7aF211d84289783ed97ffC5Fefa14256',
    bobaToken: '0x4200000000000000000000000000000000000023',
    bundlerUrl: 'https://bundler.sepolia.boba.network/rpc',
  },
};
