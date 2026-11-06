import { describe, expect, it } from 'vitest';
import { SANDBOX_DHANYA } from '../communitySeed';
import { createSandboxApi } from '../sandboxApi';

const KAVYA = `0x${'1'.padStart(40, '0')}`;
const STRANGER = `0x${'9'.repeat(40)}`;
const api = () =>
  createSandboxApi(() => 1_800_000_000, {
    owner: (id) => (id === '9001' ? KAVYA : null),
    isMember: (_id, who) => who !== STRANGER,
  }).fetch;

const act = (
  fetch: typeof globalThis.fetch,
  actor: string,
  action: string,
  extra: Record<string, unknown> = {}
) =>
  fetch('http://x/api/clubs/action', {
    method: 'POST',
    body: JSON.stringify({
      intent: { actor, clubId: '9001', action, target: '', data: '', clientId: 'c1', ...extra },
    }),
  });

describe('sandbox club API', () => {
  it('serves a seeded club with Dhanya as an admin and a feed', async () => {
    const fetch = api();
    const state = await (await fetch('http://x/api/clubs/9001')).json();
    expect(state.club.admins).toEqual([SANDBOX_DHANYA]);
    const feed = await (await fetch('http://x/api/clubs/9001/feed')).json();
    expect(feed.posts.length).toBeGreaterThan(0);
  });

  it('lets a member post, and keeps strangers and plain members to their rights', async () => {
    const fetch = api();
    expect((await act(fetch, STRANGER, 'post', { data: '{"text":"hi"}' })).status).toBe(403);
    expect(
      (
        await act(fetch, SANDBOX_DHANYA, 'post', {
          data: '{"text":"Race day","announcement":true}',
        })
      ).status
    ).toBe(200);
    expect(
      (await act(fetch, `0x${'4'.padStart(40, '0')}`, 'settings', { data: '{"inviteOnly":true}' }))
        .status
    ).toBe(403);
    const feed = await (await fetch('http://x/api/clubs/9001/feed')).json();
    expect(feed.posts[0].text).toBe('Race day');
  });

  it('runs a join request through approval', async () => {
    const fetch = api();
    expect(await (await act(fetch, STRANGER, 'request')).json()).toEqual({ status: 'pending' });
    await act(fetch, KAVYA, 'decide', { target: STRANGER, data: '{"approve":true}' });
    const state = await (await fetch('http://x/api/clubs/9001')).json();
    expect(state.club.requests[0]).toMatchObject({ member: STRANGER, status: 'approved' });
  });
});
