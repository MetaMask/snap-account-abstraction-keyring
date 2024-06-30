// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {SafeSingletonDeployer} from "safe-singleton-deployer-sol/src/SafeSingletonDeployer.sol";

import {CoinbaseSmartWallet, CoinbaseSmartWalletFactory} from "../contracts/coinbase/CoinbaseSmartWalletFactory.sol";

contract DeployFactoryScript is Script {
    // address constant EXPECTED_IMPLEMENTATION = 0xeb12222dbfe0fEfe0D5D693eC61aC51ab48518Ce;
    // address constant EXPECTED_FACTORY = 0x206B2C8fBb4D37551513FE9c2bD872996b2d8b1f;

    function run() public {
        console2.log("Deploying on chain ID", block.chainid);
        address implementation = SafeSingletonDeployer.broadcastDeploy({
            creationCode: type(CoinbaseSmartWallet).creationCode,
            salt: 0x3438ae5ce1ff7750c1e09c4b28e2a04525da412f91561eb5b57729977f591fbd
        });
        console2.log("implementation", implementation);
        // assert(implementation == EXPECTED_IMPLEMENTATION);
        address factory = SafeSingletonDeployer.broadcastDeploy({
            creationCode: type(CoinbaseSmartWalletFactory).creationCode,
            args: abi.encode(implementation),
            salt: 0x278d06dab87f67bb2d83470a70c8975a2c99872f290058fb43bcc47da5f0390d
        });
        console2.log("factory", factory);
        // assert(factory == EXPECTED_FACTORY);
    }
}
