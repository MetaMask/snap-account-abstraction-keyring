/* eslint-disable camelcase */
import { ethers, network } from 'hardhat';

import { SimpleAccountFactory__factory } from '../src/types';

/**
 * Main function for deploying the contract.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const SimpleAccountFactory = new SimpleAccountFactory__factory(deployer!);

  const contract = await SimpleAccountFactory.deploy(
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  );

  const networkName = network.name;

  console.log(
    `\nSimpleAccountFactory deployed to ${networkName} network\nAddress: ${contract.target}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
