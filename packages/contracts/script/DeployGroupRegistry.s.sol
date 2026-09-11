// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {GroupRegistry} from "../src/GroupRegistry.sol";

contract DeployGroupRegistry is Script {
    function run() external returns (GroupRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        GroupRegistry registry = new GroupRegistry();

        vm.stopBroadcast();

        console.log("GroupRegistry deployed at:", address(registry));
        return registry;
    }
}
