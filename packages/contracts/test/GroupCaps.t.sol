// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {GroupRegistry} from "../src/GroupRegistry.sol";
import {IGroupRegistry} from "../src/interfaces/IGroupRegistry.sol";
import {EventRegistry} from "../src/EventRegistry.sol";
import {IEventRegistry} from "../src/interfaces/IEventRegistry.sol";
import {ActivityRegistry} from "../src/ActivityRegistry.sol";
import {IActivityRegistry} from "../src/interfaces/IActivityRegistry.sol";
import {SocialRegistry} from "../src/SocialRegistry.sol";
import {ISocialRegistry} from "../src/interfaces/ISocialRegistry.sol";

/// Unbounded strings let anyone make a club or event so large that listing them fails for everyone.
contract StringCapsTest is Test {
    address alice = makeAddr("alice");

    function _repeat(uint256 n) internal pure returns (string memory) {
        return string(new bytes(n));
    }

    function _filled(uint256 n) internal pure returns (string memory) {
        bytes memory b = new bytes(n);
        for (uint256 i = 0; i < n; i++) {
            b[i] = "a";
        }
        return string(b);
    }

    function test_Group_CapsNameLocationAndDescription() public {
        GroupRegistry groups = new GroupRegistry();
        vm.startPrank(alice);

        vm.expectRevert(IGroupRegistry.NameTooLong.selector);
        groups.createGroup(_filled(65), "Pune", "desc", 0);
        vm.expectRevert(IGroupRegistry.LocationTooLong.selector);
        groups.createGroup("Club", _filled(65), "desc", 0);
        vm.expectRevert(IGroupRegistry.DescriptionTooLong.selector);
        groups.createGroup("Club", "Pune", _filled(501), 0);

        // Exactly at the limit is fine.
        groups.createGroup(_filled(64), _filled(64), _filled(500), 0);
        vm.stopPrank();
    }

    function test_Event_CapsTitleAndDescription() public {
        EventRegistry events = new EventRegistry();
        vm.startPrank(alice);

        vm.expectRevert(IEventRegistry.TitleTooLong.selector);
        events.createEvent(_filled(101), "d", 0, 1, 2, 1000, 0, 0);
        vm.expectRevert(IEventRegistry.DescriptionTooLong.selector);
        events.createEvent("t", _filled(1001), 0, 1, 2, 1000, 0, 0);

        events.createEvent(_filled(100), _filled(1000), 0, 1, 2, 1000, 0, 0);
        vm.stopPrank();
    }

    function test_Cids_AreCapped() public {
        ActivityRegistry activities = new ActivityRegistry();
        vm.startPrank(alice);
        uint256 id = activities.recordActivity(keccak256("a"), 0, 1000, 600, 0);

        vm.expectRevert(IActivityRegistry.CidTooLong.selector);
        activities.setActivityMetadata(id, _filled(129));
        activities.setActivityMetadata(id, _filled(128));
        vm.stopPrank();

        SocialRegistry social = new SocialRegistry();
        vm.startPrank(alice);
        vm.expectRevert(ISocialRegistry.CidTooLong.selector);
        social.addComment(id, keccak256("c1"), _filled(129));
        social.addComment(id, keccak256("c2"), _filled(128));
        vm.stopPrank();
    }
}
