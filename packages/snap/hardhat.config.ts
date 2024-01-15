/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-unassigned-import */
import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'dotenv/config';

const MNEMONIC = process.env.MNEMONIC!;
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID!;

const config: HardhatUserConfig = {
  solidity: '0.8.19',
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v6',
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    dontOverrideCompile: false, // defaults to false
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
  },
};

export default config;
