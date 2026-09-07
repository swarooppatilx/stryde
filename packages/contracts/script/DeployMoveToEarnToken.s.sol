// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MoveToEarnToken} from "../src/MoveToEarnToken.sol";

contract DeployMoveToEarnToken is Script {
    function run() external returns (MoveToEarnToken) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MoveToEarnToken token = new MoveToEarnToken();

        vm.stopBroadcast();

        console.log("MoveToEarnToken deployed at:", address(token));
        return token;
    }
}
