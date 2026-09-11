import { BigInt } from '@graphprotocol/graph-ts';
import {
  GroupCreated,
  GroupDissolved,
  GroupJoined,
  GroupLeft,
  GroupOwnershipTransferred,
  TreasuryDeposited,
  TreasuryWithdrawn,
} from '../../generated/GroupRegistry/GroupRegistry';
import { Group, GroupMember } from '../../generated/schema';

function memberId(groupId: string, member: string): string {
  return groupId.concat('-').concat(member);
}

export function handleGroupCreated(event: GroupCreated): void {
  const groupId = event.params.groupId.toString();

  const group = new Group(groupId);
  group.owner = event.params.owner;
  group.name = event.params.name;
  group.location = event.params.location;
  group.description = event.params.description;
  group.sportType = event.params.sportType;
  group.memberCount = BigInt.fromI32(1);
  group.createdAt = event.params.createdAt;
  group.active = true;
  group.treasuryBalance = BigInt.fromI32(0);
  group.save();

  const member = new GroupMember(memberId(groupId, event.params.owner.toHexString()));
  member.group = groupId;
  member.user = event.params.owner;
  member.joinedAt = event.params.createdAt;
  member.active = true;
  member.save();
}

export function handleGroupJoined(event: GroupJoined): void {
  const groupId = event.params.groupId.toString();
  const group = Group.load(groupId);
  if (!group) return;

  group.memberCount = event.params.memberCount;
  group.save();

  const id = memberId(groupId, event.params.member.toHexString());
  let member = GroupMember.load(id);
  if (!member) {
    member = new GroupMember(id);
    member.group = groupId;
    member.user = event.params.member;
  }
  member.joinedAt = event.block.timestamp;
  member.active = true;
  member.save();
}

export function handleGroupLeft(event: GroupLeft): void {
  const groupId = event.params.groupId.toString();
  const group = Group.load(groupId);
  if (!group) return;

  group.memberCount = event.params.memberCount;
  group.save();

  const member = GroupMember.load(memberId(groupId, event.params.member.toHexString()));
  if (member) {
    member.active = false;
    member.save();
  }
}

export function handleGroupDissolved(event: GroupDissolved): void {
  const groupId = event.params.groupId.toString();
  const group = Group.load(groupId);
  if (!group) return;

  group.active = false;
  group.memberCount = BigInt.fromI32(0);
  group.owner = null;
  group.save();

  const member = GroupMember.load(memberId(groupId, event.params.lastOwner.toHexString()));
  if (member) {
    member.active = false;
    member.save();
  }
}

export function handleGroupOwnershipTransferred(event: GroupOwnershipTransferred): void {
  const groupId = event.params.groupId.toString();
  const group = Group.load(groupId);
  if (!group) return;

  group.owner = event.params.newOwner;
  group.save();
}

export function handleTreasuryDeposited(event: TreasuryDeposited): void {
  const groupId = event.params.groupId.toString();
  const group = Group.load(groupId);
  if (!group) return;

  group.treasuryBalance = event.params.newBalance;
  group.save();
}

export function handleTreasuryWithdrawn(event: TreasuryWithdrawn): void {
  const groupId = event.params.groupId.toString();
  const group = Group.load(groupId);
  if (!group) return;

  group.treasuryBalance = event.params.newBalance;
  group.save();
}
