import { afterEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';
vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getKudosFromSubgraph, getCommentsFromSubgraph } = await import('../subgraphSocial');

const GIVER = '0x00000000000000000000000000000000000000AB';

function reply(collection: string, rows: unknown[]) {
  const bodies: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(init.body);
      return new Response(JSON.stringify({ data: { [collection]: rows } }));
    })
  );
  return bodies;
}

afterEach(() => {
  vi.unstubAllGlobals();
  subgraphUrl = 'https://graph.test/q';
});

describe('getKudosFromSubgraph', () => {
  it('is null without a subgraph, so callers scan logs instead', async () => {
    subgraphUrl = undefined;

    expect(await getKudosFromSubgraph()).toBeNull();
  });

  it('lists the newest kudos first, with lower-case givers and numeric ids', async () => {
    const bodies = reply('activityKudos_collection', [
      {
        id: '0x01',
        activity: { id: 'a', activityId: '5' },
        giver: { id: GIVER },
        givenAt: '100',
        active: true,
      },
      {
        id: '0x02',
        activity: { id: 'b', activityId: '6' },
        giver: { id: GIVER },
        givenAt: '300',
        active: true,
      },
    ]);

    const kudos = await getKudosFromSubgraph();

    expect(kudos?.map((k) => k.activityId)).toEqual([6n, 5n]);
    expect(kudos?.[0]).toEqual({
      activityId: 6n,
      giver: GIVER.toLowerCase(),
      timestamp: 300,
      active: true,
    });
    // Revoked kudos never reach the app.
    expect(bodies[0]).toContain('active: true');
  });
});

describe('getCommentsFromSubgraph', () => {
  it('is null without a subgraph', async () => {
    subgraphUrl = undefined;

    expect(await getCommentsFromSubgraph()).toBeNull();
  });

  it('lists the newest comments first, with lower-case authors', async () => {
    reply('activityComments', [
      {
        id: '0x01',
        activity: { id: 'a', activityId: '5' },
        author: { id: GIVER },
        cid: 'bafy1',
        createdAt: '10',
      },
      {
        id: '0x02',
        activity: { id: 'a', activityId: '5' },
        author: { id: GIVER },
        cid: 'bafy2',
        createdAt: '20',
      },
    ]);

    const comments = await getCommentsFromSubgraph();

    expect(comments?.map((c) => c.cid)).toEqual(['bafy2', 'bafy1']);
    expect(comments?.[0]).toMatchObject({
      activityId: 5n,
      author: GIVER.toLowerCase(),
      createdAt: 20,
    });
  });
});
