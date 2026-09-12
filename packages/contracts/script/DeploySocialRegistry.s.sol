// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SocialRegistry} from "../src/SocialRegistry.sol";

contract DeploySocialRegistry is Script {
    function run() external returns (SocialRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        SocialRegistry registry = new SocialRegistry();

        vm.stopBroadcast();

        console.log("SocialRegistry deployed at:", address(registry));
        return registry;
    }
}
