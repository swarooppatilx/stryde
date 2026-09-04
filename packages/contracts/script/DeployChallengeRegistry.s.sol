// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";

contract DeployChallengeRegistry is Script {
    function run() external returns (ChallengeRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ChallengeRegistry registry = new ChallengeRegistry();

        vm.stopBroadcast();

        console.log("ChallengeRegistry deployed at:", address(registry));
        return registry;
    }
}
