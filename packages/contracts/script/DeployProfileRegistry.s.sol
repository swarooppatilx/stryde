// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";

contract DeployProfileRegistry is Script {
    function run() external returns (ProfileRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ProfileRegistry registry = new ProfileRegistry();

        vm.stopBroadcast();

        console.log("ProfileRegistry deployed at:", address(registry));
        return registry;
    }
}
