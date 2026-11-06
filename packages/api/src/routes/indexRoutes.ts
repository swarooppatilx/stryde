import { Hono } from 'hono';
import type { EventQuery } from '../lib/index/arkivMirror.js';
import { getMirrorRuntime } from '../lib/index/arkivRuntime.js';
import type { Freshness } from '../lib/index/freshness.js';
import type { StoredEvent } from '../lib/index/mirror.js';
import type { Address } from '../lib/index/types.js';
import {
  achievementCounts,
  activitiesView,
  contributionTotals,
  groupMembers,
  profilesView,
  territoriesView,
} from '../lib/index/views.js';

export interface IndexDeps {
  fresh(): Promise<Freshness>;
  events(query: EventQuery): Promise<StoredEvent[]>;
}

const WALLET = /^0x[0-9a-fA-F]{40}$/;
const DIGITS = /^\d{1,20}$/;
const PROFILE_KINDS = ['ProfileCreated', 'ProfileUpdated', 'AvatarUpdated', 'ProfileVerified'];
const TERRITORY_KINDS = [
  'TerritoryClaimed',
  'TerritoryReinforced',
  'TerritoryLost',
  'TerritoryDecayed',
];
const ACTIVITY_KINDS = ['ActivityRecorded', 'ActivityMetadataUpdated'];
const DEFAULT_ACTIVITY_LIMIT = 200;
const MAX_ACTIVITY_LIMIT = 1_000;

/**
 * Read endpoints over the Arkiv mirror, shaped like what the subgraph queries returned so the app can
 * switch without changing its screens. Every answer says which chain block the mirror had reached and
 * whether the last refresh failed, because a mirror can lag the chain.
 */
export function createIndexRoutes(deps: IndexDeps) {
  const routes = new Hono();

  const of = async (kinds: string[], query: Omit<EventQuery, 'kind'> = {}) =>
    (await Promise.all(kinds.map((kind) => deps.events({ kind, ...query })))).flat();

  routes.get('/profiles', async (c) => {
    const fresh = await deps.fresh();
    return c.json({ profiles: profilesView(await of(PROFILE_KINDS)), ...fresh });
  });

  routes.get('/leaderboard/:seasonId', async (c) => {
    const seasonId = c.req.param('seasonId');
    if (!DIGITS.test(seasonId)) return c.json({ error: 'Invalid season' }, 400);
    const fresh = await deps.fresh();
    const [contributions, profileEvents, territoryEvents, achievements] = await Promise.all([
      deps.events({ kind: 'ContributionRecorded', ref: seasonId }),
      of(PROFILE_KINDS),
      of(TERRITORY_KINDS),
      deps.events({ kind: 'AchievementMinted' }),
    ]);
    const totals = contributionTotals(contributions, seasonId);
    const profiles = new Map(profilesView(profileEvents).map((p) => [p.wallet, p]));
    const holdings = new Map<Address, number>();
    for (const t of territoriesView(territoryEvents)) {
      if (t.isActive) holdings.set(t.owner, (holdings.get(t.owner) ?? 0) + t.areaSqm);
    }
    const held = achievementCounts(achievements);
    // The score is left to the app, which already owns the weights (services/subgraphSeason.ts).
    const entries = [...totals]
      .map(([wallet, distance]) => ({
        wallet,
        username: profiles.get(wallet)?.username ?? 'Unknown',
        isVerified: profiles.get(wallet)?.isVerified ?? false,
        distance,
        territoryArea: holdings.get(wallet) ?? 0,
        achievementCount: held.get(wallet) ?? 0,
      }))
      .sort((a, b) => b.distance - a.distance);
    return c.json({ entries, ...fresh });
  });

  routes.get('/territories', async (c) => {
    const fresh = await deps.fresh();
    return c.json({ territories: territoriesView(await of(TERRITORY_KINDS)), ...fresh });
  });

  routes.get('/group/:id/members', async (c) => {
    const id = c.req.param('id');
    if (!DIGITS.test(id)) return c.json({ error: 'Invalid group' }, 400);
    const fresh = await deps.fresh();
    const events = await of(['GroupCreated', 'GroupJoined', 'GroupLeft', 'GroupDissolved'], {
      ref: id,
    });
    return c.json({ members: groupMembers(events), ...fresh });
  });

  routes.get('/athlete/:wallet', async (c) => {
    const wallet = c.req.param('wallet').toLowerCase() as Address;
    if (!WALLET.test(wallet)) return c.json({ error: 'Invalid wallet' }, 400);
    const fresh = await deps.fresh();
    const [profileEvents, territoryEvents, achievementEvents, contributionEvents, activityEvents] =
      await Promise.all([
        of(PROFILE_KINDS),
        of(TERRITORY_KINDS),
        deps.events({ kind: 'AchievementMinted', who: wallet }),
        deps.events({ kind: 'ContributionRecorded', who: wallet }),
        of(ACTIVITY_KINDS, { who: wallet }),
      ]);
    const profile = profilesView(profileEvents).find((p) => p.wallet === wallet);
    if (!profile) return c.json({ error: 'No profile for this wallet' }, 404);
    const seasons = [...new Set(contributionEvents.map((e) => e.ref))];
    return c.json({
      athlete: {
        ...profile,
        activities: activitiesView(activityEvents),
        territories: territoriesView(territoryEvents).filter((t) => t.owner === wallet),
        achievements: achievementEvents.map((e) => ({ achievementId: e.ref, mintedAt: e.ts })),
        contributions: seasons.map((seasonId) => ({
          seasonId,
          distance: contributionTotals(contributionEvents, seasonId).get(wallet) ?? 0,
        })),
      },
      ...fresh,
    });
  });

  routes.get('/activities', async (c) => {
    const wallet = c.req.query('wallet')?.toLowerCase();
    if (wallet !== undefined && !WALLET.test(wallet))
      return c.json({ error: 'Invalid wallet' }, 400);
    const hash = c.req.query('hash');
    const limit = Math.min(
      Number(c.req.query('limit')) || DEFAULT_ACTIVITY_LIMIT,
      MAX_ACTIVITY_LIMIT
    );
    const fresh = await deps.fresh();
    let rows = activitiesView(await of(ACTIVITY_KINDS, wallet ? { who: wallet as Address } : {}));
    if (hash) rows = rows.filter((r) => r.activityHash === hash);
    if (c.req.query('withRoute')) rows = rows.filter((r) => r.metadataCid);
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return c.json({ activities: rows.slice(0, limit), ...fresh });
  });

  return routes;
}

/** The routes over the real mirror; built lazily on the first request. */
export const indexRoutes = createIndexRoutes({
  fresh: () => getMirrorRuntime().fresh.ensure(),
  events: (query) => getMirrorRuntime().mirror.events(query),
});
