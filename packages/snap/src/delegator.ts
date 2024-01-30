import {
  chainId,
  DELEGATOR_ENV_CONTRACTS,
  DeleGatorSdk,
} from '@metamask/delegator-sdk';

import { provider } from './utils/ethers';

const bundlerUrl = process.env.BUNDLER_URL!;

export const delegatorSdk = new DeleGatorSdk({
  chainId: chainId.sepolia,
  contracts: DELEGATOR_ENV_CONTRACTS[chainId.sepolia],
  provider,
  bundlerUrl,
});
