// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TerritoryRegistry} from "../src/TerritoryRegistry.sol";

contract DeployTerritoryRegistry is Script {
    function run() external returns (TerritoryRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        TerritoryRegistry registry = new TerritoryRegistry();

        vm.stopBroadcast();

        console.log("TerritoryRegistry deployed at:", address(registry));
        return registry;
    }
}
