import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getGroupMembersFromSubgraph } = await import('../subgraph');

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';

let sent: { query: string; variables: Record<string, unknown> }[];

beforeEach(() => {
  subgraphUrl = 'https://graph.test/q';
  sent = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return {
        ok: true,
        json: async () => ({
          data: { groupMembers: [{ user: { id: A } }, { user: { id: B } }] },
        }),
      };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('getGroupMembersFromSubgraph', () => {
  it("lists a group's current members by wallet", async () => {
    expect(await getGroupMembersFromSubgraph(7n)).toEqual([A, B]);
  });

  it('asks only for that group, and only for members who are still in it', async () => {
    await getGroupMembersFromSubgraph(7n);

    expect(sent[0]?.variables).toMatchObject({ group: '7' });
    expect(sent[0]?.query).toContain('active: true');
  });

  it('answers null, not an error, when no subgraph is configured here', async () => {
    subgraphUrl = undefined;

    expect(await getGroupMembersFromSubgraph(7n)).toBeNull();
  });
});
