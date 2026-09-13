// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EventRegistry} from "../src/EventRegistry.sol";

contract DeployEventRegistry is Script {
    function run() external returns (EventRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        EventRegistry registry = new EventRegistry();

        vm.stopBroadcast();

        console.log("EventRegistry deployed at:", address(registry));
        return registry;
    }
}
