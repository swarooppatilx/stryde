import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl: 'https://graph.test/q' }) };
});

const { getActivitiesFromSubgraph } = await import('../subgraph');

const ME = '0x00000000000000000000000000000000000000AA';

function entity(i: number, owner: string) {
  return {
    id: `a${i}`,
    activityId: String(i),
    user: { id: owner },
    activityHash: `0x${i}`,
    activityType: 0,
    distance: '1000',
    duration: '600',
    territoryArea: '0',
    timestamp: '1700000000',
    metadataCid: null,
  };
}

let queries: string[];

beforeEach(() => {
  queries = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const { query, variables } = JSON.parse(init.body);
      queries.push(query + JSON.stringify(variables ?? {}));
      return { ok: true, json: async () => ({ data: { activities: [entity(1, ME)] } }) };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('getActivitiesFromSubgraph', () => {
  it('asks only for the given wallet, so a challenge sums just that athlete', async () => {
    await getActivitiesFromSubgraph(ME as `0x${string}`);

    expect(queries[0]).toContain(ME.toLowerCase());
  });

  it('asks for everyone when no wallet is given', async () => {
    await getActivitiesFromSubgraph();

    expect(queries[0]).not.toContain('user_');
  });

  it('refuses a malformed wallet instead of splicing it into the query', async () => {
    await expect(getActivitiesFromSubgraph('0x1" } ' as `0x${string}`)).rejects.toThrow(
      /Invalid wallet/
    );
  });
});
