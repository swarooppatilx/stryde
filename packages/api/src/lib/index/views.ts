import type { StoredEvent } from './mirror.js';
import { compare } from './order.js';
import type { Address } from './types.js';

/** Chain order: block, then log index; `evt` is built so plain string order is exactly that. */
const inOrder = (events: readonly StoredEvent[]) =>
  [...events].sort((a, b) => compare(a.evt, b.evt));

export interface ProfileRow {
  wallet: Address;
  /** The registry's id for this profile, as text. */
  profileId: string;
  username: string;
  isVerified: boolean;
  avatarCid: string | null;
}

/** Profiles as they stand now: the creation, then the newest rename, avatar and verification applied over it. */
export function profilesView(events: readonly StoredEvent[]): ProfileRow[] {
  const byWallet = new Map<Address, ProfileRow>();
  const walletOfProfile = new Map<string, Address>();
  for (const e of inOrder(events)) {
    if (e.kind === 'ProfileCreated') {
      walletOfProfile.set(e.ref, e.who);
      byWallet.set(e.who, {
        wallet: e.who,
        profileId: e.ref,
        username: e.data.username ?? '',
        isVerified: false,
        avatarCid: null,
      });
    } else if (e.kind === 'ProfileUpdated') {
      // The rename names a profile id, not a wallet.
      const row = byWallet.get(walletOfProfile.get(e.ref) ?? ('' as Address));
      if (row) row.username = e.data.username ?? row.username;
    } else if (e.kind === 'AvatarUpdated') {
      const row = byWallet.get(e.who);
      if (row) row.avatarCid = e.data.cid || null;
    } else if (e.kind === 'ProfileVerified') {
      const row = byWallet.get(e.who);
      if (row) row.isVerified = true;
    }
  }
  return [...byWallet.values()];
}

/** Each athlete's newest running total for one season. */
export function contributionTotals(
  events: readonly StoredEvent[],
  seasonId: string
): Map<Address, number> {
  const totals = new Map<Address, number>();
  for (const e of inOrder(events)) {
    if (e.kind === 'ContributionRecorded' && e.ref === seasonId)
      totals.set(e.who, Number(e.data.total ?? 0));
  }
  return totals;
}

/** How many distinct achievements each athlete holds. */
export function achievementCounts(events: readonly StoredEvent[]): Map<Address, number> {
  const held = new Map<Address, Set<string>>();
  for (const e of events) {
    if (e.kind !== 'AchievementMinted') continue;
    held.set(e.who, (held.get(e.who) ?? new Set()).add(e.ref));
  }
  return new Map([...held].map(([wallet, ids]) => [wallet, ids.size]));
}

/** Who is in one club now, in the order they joined; a dissolved club has nobody. */
export function groupMembers(events: readonly StoredEvent[]): Address[] {
  const members = new Map<Address, number>();
  let order = 0;
  for (const e of inOrder(events)) {
    // GroupRegistry adds the creator as the first member without emitting a join.
    if (e.kind === 'GroupJoined' || e.kind === 'GroupCreated') members.set(e.who, order++);
    else if (e.kind === 'GroupLeft') members.delete(e.who);
    else if (e.kind === 'GroupDissolved') members.clear();
  }
  return [...members].sort((a, b) => a[1] - b[1]).map(([wallet]) => wallet);
}

export interface TerritoryRow {
  id: string;
  owner: Address;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
  isActive: boolean;
  /** Degrees; the registry stores them times a million. */
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
}

const degrees = (value: string | undefined) => Number(value ?? 0) / 1_000_000;

/** Territories and who holds them now: a claim sets the holder, a reinforcement keeps them, a loss clears them. */
export function territoriesView(events: readonly StoredEvent[]): TerritoryRow[] {
  const rows = new Map<string, TerritoryRow>();
  for (const e of inOrder(events)) {
    if (e.kind === 'TerritoryClaimed') {
      const at = Number(e.data.capturedAt ?? 0);
      rows.set(e.ref, {
        id: e.ref,
        owner: e.who,
        areaSqm: Number(e.data.areaSqm ?? 0),
        strength: Number(e.data.strength ?? 0),
        capturedAt: at,
        lastReinforced: at,
        isActive: true,
        bounds: {
          minLng: degrees(e.data.minLng),
          minLat: degrees(e.data.minLat),
          maxLng: degrees(e.data.maxLng),
          maxLat: degrees(e.data.maxLat),
        },
      });
      continue;
    }
    const row = rows.get(e.ref);
    if (!row) continue;
    if (e.kind === 'TerritoryReinforced') {
      row.owner = e.who;
      row.isActive = true;
      row.strength = Number(e.data.strength ?? row.strength);
      row.lastReinforced = Number(e.data.reinforcedAt ?? row.lastReinforced);
    } else if (e.kind === 'TerritoryLost') {
      row.isActive = false;
    } else if (e.kind === 'TerritoryDecayed') {
      row.strength = Number(e.data.remainingStrength ?? row.strength);
    }
  }
  return [...rows.values()];
}

export interface ActivityRow {
  activityId: string;
  user: Address;
  activityHash: string;
  activityType: number;
  distance: number;
  duration: number;
  timestamp: number;
  territoryArea: number;
  metadataCid: string | null;
}

/** Recorded activities, each with the newest metadata pointer set for it (null when none was). */
export function activitiesView(events: readonly StoredEvent[]): ActivityRow[] {
  const rows = new Map<string, ActivityRow>();
  for (const e of inOrder(events)) {
    if (e.kind === 'ActivityRecorded') {
      rows.set(e.ref, {
        activityId: e.data.activityId ?? e.ref,
        user: e.who,
        activityHash: e.data.activityHash ?? '',
        activityType: Number(e.data.activityType ?? 0),
        distance: Number(e.data.distance ?? 0),
        duration: Number(e.data.duration ?? 0),
        timestamp: Number(e.data.timestamp ?? 0),
        territoryArea: Number(e.data.territoryArea ?? 0),
        metadataCid: null,
      });
    } else if (e.kind === 'ActivityMetadataUpdated') {
      const row = rows.get(e.ref);
      if (row) row.metadataCid = e.data.metadataCid || null;
    }
  }
  return [...rows.values()];
}
