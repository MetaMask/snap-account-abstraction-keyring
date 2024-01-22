/* eslint-disable camelcase */
import { ethers } from 'hardhat';

import { SimpleAccountFactory__factory } from '../src/types';

/**
 * Main function for deploying the contract.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const SimpleAccountFactory = new SimpleAccountFactory__factory(deployer);

  const contract = await SimpleAccountFactory.deploy(
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  );

  console.log('SimpleAccountFactory deployed to:', contract.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
