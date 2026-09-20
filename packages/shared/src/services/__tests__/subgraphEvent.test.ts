import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getEventsFromSubgraph, getUserEventsFromSubgraph } = await import('../subgraph');

const HOST = '0x00000000000000000000000000000000000000aa';
const ME = '0x00000000000000000000000000000000000000BB';

const entity = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  host: { id: HOST },
  title: `Event ${id}`,
  description: 'About',
  sportType: 1,
  startTime: '1000',
  endTime: '2000',
  distanceGoal: '50000',
  startLat: 18.5,
  startLng: 73.8,
  participantCount: '4',
  createdAt: '100',
  active: true,
  ...over,
});

let sent: { query: string; variables: Record<string, unknown> }[];
let respond: (body: { query: string; variables: Record<string, unknown> }) => unknown;

beforeEach(() => {
  subgraphUrl = 'https://graph.test/q';
  sent = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      sent.push(body);
      return { ok: true, json: async () => ({ data: respond(body) }) };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('getEventsFromSubgraph', () => {
  it('has nothing to say without a subgraph, rather than failing', async () => {
    subgraphUrl = undefined;

    expect(await getEventsFromSubgraph()).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('maps each event and lists the newest first', async () => {
    respond = () => ({
      events: [entity('1', { createdAt: '100' }), entity('2', { createdAt: '300' })],
    });

    const events = await getEventsFromSubgraph();

    expect(events?.map((e) => e.id)).toEqual([2n, 1n]);
    expect(events?.[1]).toMatchObject({
      host: HOST,
      title: 'Event 1',
      startTime: 1000,
      endTime: 2000,
      distanceGoal: 50_000,
      participantCount: 4,
      active: true,
    });
  });

  it('falls back to the zero address when an event has no host', async () => {
    respond = () => ({ events: [entity('1', { host: null })] });

    const [event] = (await getEventsFromSubgraph()) ?? [];

    expect(event?.host).toBe('0x0000000000000000000000000000000000000000');
  });
});

describe('getUserEventsFromSubgraph', () => {
  it('asks for the wallet in lower case', async () => {
    respond = () => ({ eventParticipants: [] });

    await getUserEventsFromSubgraph(ME as `0x${string}`);

    expect(sent[0]?.variables.wallet).toBe(ME.toLowerCase());
  });

  it('lists only the events that are still active', async () => {
    respond = () => ({
      eventParticipants: [{ event: entity('1') }, { event: entity('2', { active: false }) }],
    });

    const events = await getUserEventsFromSubgraph(ME as `0x${string}`);

    expect(events?.map((e) => e.id)).toEqual([1n]);
  });

  it('has nothing to say without a subgraph', async () => {
    subgraphUrl = undefined;

    expect(await getUserEventsFromSubgraph(ME as `0x${string}`)).toBeNull();
  });
});
