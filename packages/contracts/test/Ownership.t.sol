// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {ActivityRegistry} from "../src/ActivityRegistry.sol";
import {TerritoryRegistry} from "../src/TerritoryRegistry.sol";
import {SeasonManager} from "../src/SeasonManager.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {TerritoryNFT} from "../src/TerritoryNFT.sol";
import {MoveToEarnToken} from "../src/MoveToEarnToken.sol";
import {GroupRegistry} from "../src/GroupRegistry.sol";
import {SocialRegistry} from "../src/SocialRegistry.sol";
import {EventRegistry} from "../src/EventRegistry.sol";

/// Handing a contract to a mistyped address must not lose it: the new owner has to accept.
contract OwnershipTest is Test {
    address bob = makeAddr("bob");
    address mallory = makeAddr("mallory");

    function _contracts() internal returns (Ownable2Step[11] memory list) {
        list[0] = Ownable2Step(address(new ProfileRegistry()));
        list[1] = Ownable2Step(address(new ActivityRegistry()));
        list[2] = Ownable2Step(address(new TerritoryRegistry()));
        list[3] = Ownable2Step(address(new SeasonManager()));
        list[4] = Ownable2Step(address(new AchievementRegistry()));
        list[5] = Ownable2Step(address(new ChallengeRegistry()));
        list[6] = Ownable2Step(address(new TerritoryNFT()));
        list[7] = Ownable2Step(address(new MoveToEarnToken()));
        list[8] = Ownable2Step(address(new GroupRegistry()));
        list[9] = Ownable2Step(address(new SocialRegistry()));
        list[10] = Ownable2Step(address(new EventRegistry()));
    }

    function test_EveryContract_OwnershipTransferNeedsAcceptance() public {
        Ownable2Step[11] memory list = _contracts();
        for (uint256 i = 0; i < list.length; i++) {
            Ownable2Step c = list[i];

            c.transferOwnership(bob);
            // Still ours until bob accepts.
            assertEq(c.owner(), address(this));
            assertEq(c.pendingOwner(), bob);

            vm.prank(mallory);
            vm.expectRevert();
            c.acceptOwnership();

            vm.prank(bob);
            c.acceptOwnership();
            assertEq(c.owner(), bob);
            assertEq(c.pendingOwner(), address(0));
        }
    }

    function test_EveryContract_ATransferToTheWrongAddressCanBeCorrected() public {
        Ownable2Step[11] memory list = _contracts();
        for (uint256 i = 0; i < list.length; i++) {
            Ownable2Step c = list[i];

            c.transferOwnership(mallory); // a typo
            c.transferOwnership(bob); // noticed in time, redirected

            vm.prank(mallory);
            vm.expectRevert();
            c.acceptOwnership();
            assertEq(c.owner(), address(this));
        }
    }
}
