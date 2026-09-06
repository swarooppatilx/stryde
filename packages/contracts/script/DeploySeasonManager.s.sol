// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SeasonManager} from "../src/SeasonManager.sol";

contract DeploySeasonManager is Script {
    function run() external returns (SeasonManager) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        SeasonManager manager = new SeasonManager();

        vm.stopBroadcast();

        console.log("SeasonManager deployed at:", address(manager));
        return manager;
    }
}
