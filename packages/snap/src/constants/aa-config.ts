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
    simpleAccountFactory: '0xBfc0acf30682F2d1A8594B61100b6ccb64302c05',
    bobaPaymaster: '0x',
    bobaToken: '0x33faF65b3DfcC6A1FccaD4531D9ce518F0FDc896',
    bundlerUrl: '',
  },
  [CHAIN_IDS.BOBA_SEPOLIA]: {
    version: '0.6.0',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    simpleAccountFactory: '0x9406cc6185a346906296840746125a0e44976454',
    bobaPaymaster: '0x',
    bobaToken: '0x4200000000000000000000000000000000000023',
    bundlerUrl: '',
  },
};
