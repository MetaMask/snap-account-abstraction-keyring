/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable camelcase */
import { ethers } from 'hardhat';

import { VerifyingPaymaster__factory } from '../src/types';

/**
 * Main function for deploying the contract.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const VerifyingPaymasterFactory = new VerifyingPaymaster__factory(deployer!);

  const contract = await VerifyingPaymasterFactory.deploy(
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    deployer!.address,
  );

  console.log('Verifying Signer deployed to:', contract.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
