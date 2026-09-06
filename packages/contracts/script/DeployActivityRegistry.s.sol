// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ActivityRegistry} from "../src/ActivityRegistry.sol";

contract DeployActivityRegistry is Script {
    function run() external returns (ActivityRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ActivityRegistry registry = new ActivityRegistry();

        vm.stopBroadcast();

        console.log("ActivityRegistry deployed at:", address(registry));
        return registry;
    }
}
