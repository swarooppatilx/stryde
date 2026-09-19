import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getActivitiesFromSubgraph } = await import('../subgraph');

const OWNER = '0x00000000000000000000000000000000000000AA';

const entity = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  activityId: id,
  user: { id: OWNER.toLowerCase() },
  activityHash: `0xhash${id}`,
  activityType: 1,
  distance: '5000',
  duration: '1800000',
  territoryArea: '0',
  timestamp: '1000',
  metadataCid: null,
  ...over,
});

let sent: { query: string }[];
let activities: unknown[];

beforeEach(() => {
  subgraphUrl = 'https://graph.test/q';
  sent = [];
  activities = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ data: { activities } }) };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('getActivitiesFromSubgraph', () => {
  it('has nothing to say without a subgraph, so callers can fall back', async () => {
    subgraphUrl = undefined;

    expect(await getActivitiesFromSubgraph()).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('refuses a wallet that is not an address before building any query from it', async () => {
    await expect(getActivitiesFromSubgraph('0x1" } ) { id }' as `0x${string}`)).rejects.toThrow(
      /Invalid wallet/
    );
    expect(sent).toHaveLength(0);
  });

  it('filters to one athlete by lower-cased wallet when given one', async () => {
    await getActivitiesFromSubgraph(OWNER as `0x${string}`);

    expect(sent[0]?.query).toContain(`user_: { id: "${OWNER.toLowerCase()}" }`);
  });

  it('narrows to one activity by hash, and refuses anything that is not a hash', async () => {
    const hash = `0x${'AB'.repeat(32)}`;
    await getActivitiesFromSubgraph(OWNER as `0x${string}`, hash);
    expect(sent[0]?.query).toContain(`activityHash: "${hash.toLowerCase()}"`);
    expect(sent[0]?.query).toContain('user_:');
    await expect(getActivitiesFromSubgraph(undefined, '0x1" }')).rejects.toThrow(
      /Invalid activity hash/
    );
  });

  it('asks for everyone when no wallet is given', async () => {
    await getActivitiesFromSubgraph();

    expect(sent[0]?.query).not.toContain('user_');
  });

  it('maps each activity and lists the newest first', async () => {
    activities = [
      entity('1', { timestamp: '1000' }),
      entity('2', { timestamp: '3000', metadataCid: 'bafy-x', activityType: 99 }),
    ];

    const list = await getActivitiesFromSubgraph();

    expect(list?.map((a) => a.activityId)).toEqual([2n, 1n]);
    expect(list?.[0]).toMatchObject({
      owner: OWNER.toLowerCase(),
      distance: 5000,
      duration: 1_800_000,
      timestamp: 3000,
      metadataCid: 'bafy-x',
      // A sport id the app does not know reads as a run rather than breaking the list.
      activityType: 'run',
    });
    expect(list?.[1]?.metadataCid).toBeUndefined();
  });
});
