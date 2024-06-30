/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-unassigned-import */
import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-foundry';
import 'dotenv/config';
import type { NetworkUserConfig } from 'hardhat/types';

const { MNEMONIC } = process.env;
const { INFURA_PROJECT_ID } = process.env;

const networks: Record<string, NetworkUserConfig> = {
  hardhat: {
    chainId: 11155111,
    accounts: {
      mnemonic: 'test test test test test test test test test test test junk',
      count: 2,
    },
  },
};

if (MNEMONIC && INFURA_PROJECT_ID) {
  networks.sepolia = {
    url: `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.avalancheFuji = {
    url: `https://avalanche-fuji.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.arbitrumSepolia = {
    url: `https://arbitrum-sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.optimismSepolia = {
    url: `https://optimism-sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.lineaGoerli = {
    url: `https://linea-goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.celoAlfajores = {
    url: `https://celo-alfajores.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.polygonMumbai = {
    url: `https://polygon-mumbai.infura.io/v3/${INFURA_PROJECT_ID}`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
  networks.baseSepolia = {
    url: `https://dry-necessary-snow.base-sepolia.quiknode.pro/a9746d5b73e75c2e4ad1af52534434a422b6315d/9`,
    accounts: {
      mnemonic: MNEMONIC,
    },
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.23',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v6',
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    dontOverrideCompile: false, // defaults to false
  },
  networks,
};

export default config;
