import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/fileFetchShim.js', () => ({ installFileFetchShim: () => {} }));

const { default: app } = await import('../index.js');

const hit = async (path: string, times: number) => {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) {
    statuses.push((await app.request(path, { method: 'POST' })).status);
  }
  return statuses;
};

describe('rate limits per route group', () => {
  it("limits one group without spending another group's budget", async () => {
    const ipfs = await hit('/api/ipfs/upload', 40);
    expect(ipfs.at(-1)).toBe(429);

    const relay = await hit('/api/relay/mint-reward', 5);
    expect(relay).not.toContain(429);
  });

  it('lets a verification poll every two seconds for its whole three minutes', async () => {
    // 90 polls + the session create, from one client, inside one minute.
    const polls = await hit('/api/world/session/abc/poll', 91);

    expect(polls).not.toContain(429);
  });
});
