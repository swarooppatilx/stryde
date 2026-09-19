import { beforeEach, describe, expect, it, vi } from 'vitest';

const readContract = vi.hoisted(() => vi.fn());

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getPublicClient: () => ({ readContract }),
}));
// No subgraph for this chain: the on-chain scan is the only source.
vi.mock('../subgraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../subgraph')>()),
  getGroupsFromSubgraph: async () => null,
  getUserGroupsFromSubgraph: async () => null,
  getEventsFromSubgraph: async () => null,
  getUserEventsFromSubgraph: async () => null,
}));

const { getAllGroups, getUserGroups } = await import('../group');
const { getAllEvents, getUserEvents } = await import('../event');

const WALLET = '0x00000000000000000000000000000000000000aa' as const;

beforeEach(() => {
  readContract.mockReset();
  readContract.mockRejectedValue(new Error('rpc down'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// An empty list means "there are none". A failed read must not look like that,
// or one network blip erases what the user already had on screen.
describe('lists when the chain cannot be read', () => {
  it.each([
    ['all clubs', () => getAllGroups()],
    ["a wallet's clubs", () => getUserGroups(WALLET)],
    ['all events', () => getAllEvents()],
    ["a wallet's events", () => getUserEvents(WALLET)],
  ])('%s: rejects instead of returning an empty list', async (_name, load) => {
    await expect(load()).rejects.toThrow('rpc down');
  });
});
