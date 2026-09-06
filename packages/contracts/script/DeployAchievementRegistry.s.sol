// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";

contract DeployAchievementRegistry is Script {
    function run() external returns (AchievementRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AchievementRegistry registry = new AchievementRegistry();

        vm.stopBroadcast();

        console.log("AchievementRegistry deployed at:", address(registry));
        return registry;
    }
}
