// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TerritoryNFT} from "../src/TerritoryNFT.sol";

contract DeployTerritoryNFT is Script {
    function run() external returns (TerritoryNFT) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        TerritoryNFT nft = new TerritoryNFT();

        vm.stopBroadcast();

        console.log("TerritoryNFT deployed at:", address(nft));
        return nft;
    }
}
