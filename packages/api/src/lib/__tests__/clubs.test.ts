import { describe, expect, it } from 'vitest';
import type { Address } from '../address.js';
import { type ClubIntent, createClubService, createMemoryClubStore } from '../clubs.js';

const OWNER = `0x${'1'.repeat(40)}` as Address;
const ADMIN = `0x${'2'.repeat(40)}` as Address;
const MEMBER = `0x${'3'.repeat(40)}` as Address;
const STRANGER = `0x${'4'.repeat(40)}` as Address;
const NOW = 1_800_000_000;

function setup(members: Address[] = [OWNER, ADMIN, MEMBER]) {
  const store = createMemoryClubStore();
  const service = createClubService({
    store,
    chain: {
      owner: async (id) => (id === '1' ? OWNER : null),
      isMember: async (_id, who) => members.includes(who),
    },
    verify: async () => true,
    now: () => NOW,
  });
  let n = 0;
  const act = (
    actor: Address,
    action: ClubIntent['action'],
    fields: { target?: string; data?: Record<string, unknown>; clientId?: string } = {}
  ) =>
    service.apply({
      intent: {
        actor,
        clubId: '1',
        action,
        target: fields.target ?? '',
        data: fields.data ? JSON.stringify(fields.data) : '',
        clientId: fields.clientId ?? (action === 'post' || action === 'comment' ? `c${n++}` : ''),
        deadline: NOW + 60,
      },
      signature: '0xsig',
    });
  return { service, act };
}

describe('club feed', () => {
  it('lets members post and comment, and stores a retried post once', async () => {
    const { service, act } = setup();
    const first = (await act(MEMBER, 'post', {
      data: { text: 'Sunday long run?' },
      clientId: 'abc',
    })) as {
      post: { id: string };
    };
    await act(MEMBER, 'post', { data: { text: 'Sunday long run?' }, clientId: 'abc' });
    await act(OWNER, 'comment', { target: first.post.id, data: { text: '7am at the gate' } });
    const { posts } = await service.feed('1', 20);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.comments.map((c) => c.text)).toEqual(['7am at the gate']);
  });

  it('keeps strangers out, and announcements to admins', async () => {
    const { act } = setup();
    await expect(act(STRANGER, 'post', { data: { text: 'hi' } })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      act(MEMBER, 'post', { data: { text: 'hi', announcement: true } })
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      act(OWNER, 'post', { data: { text: 'Race day!', announcement: true } })
    ).resolves.toBeTruthy();
  });

  it('lets an admin delete a member post, with its comments', async () => {
    const { service, act } = setup();
    const { post } = (await act(MEMBER, 'post', { data: { text: 'spam' } })) as {
      post: { id: string };
    };
    await act(MEMBER, 'comment', { target: post.id, data: { text: 'more' } });
    await expect(act(STRANGER, 'delete-post', { target: post.id })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await act(OWNER, 'delete-post', { target: post.id });
    expect((await service.feed('1', 20)).posts).toHaveLength(0);
  });
});

describe('running the club', () => {
  it('only the owner makes admins; admins then change settings', async () => {
    const { service, act } = setup();
    await expect(act(ADMIN, 'settings', { data: { inviteOnly: true } })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await act(OWNER, 'set-role', { target: ADMIN, data: { role: 'admin' } });
    await act(ADMIN, 'settings', {
      data: { name: 'Sunrise', inviteOnly: true, adminsOnlyPost: true },
    });
    const { club } = await service.state('1');
    expect(club.admins).toEqual([ADMIN]);
    expect(club.settings).toMatchObject({
      name: 'Sunrise',
      inviteOnly: true,
      adminsOnlyPost: true,
    });
    await expect(act(MEMBER, 'post', { data: { text: 'hi' } })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('handles a join request from asking to approval', async () => {
    const { service, act } = setup();
    expect(await act(STRANGER, 'request')).toEqual({ status: 'pending' });
    await expect(
      act(MEMBER, 'decide', { target: STRANGER, data: { approve: true } })
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(await act(OWNER, 'decide', { target: STRANGER, data: { approve: true } })).toEqual({
      status: 'approved',
    });
    expect((await service.state('1')).club.requests).toEqual([
      { member: STRANGER, status: 'approved', at: NOW },
    ]);
  });

  it('removes a member, who can then no longer post', async () => {
    const { service, act } = setup();
    await act(OWNER, 'remove-member', { target: MEMBER });
    expect((await service.state('1')).club.removed).toEqual([MEMBER]);
    await expect(act(MEMBER, 'post', { data: { text: 'hi' } })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(act(OWNER, 'remove-member', { target: OWNER })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('remembers each member notification choice, everything by default', async () => {
    const { service, act } = setup();
    expect(await service.notifyLevel('1', MEMBER)).toEqual({ level: 'all' });
    await act(MEMBER, 'notify', { data: { level: 'announcements' } });
    expect(await service.notifyLevel('1', MEMBER)).toEqual({ level: 'announcements' });
  });

  it('links events to the club', async () => {
    const { service, act } = setup();
    await act(OWNER, 'link-event', { target: '42' });
    expect((await service.state('1')).club.events).toEqual(['42']);
    await act(OWNER, 'unlink-event', { target: '42' });
    expect((await service.state('1')).club.events).toEqual([]);
  });

  it('refuses an unknown club', async () => {
    const { service } = setup();
    await expect(
      service.apply({
        intent: {
          actor: OWNER,
          clubId: '9',
          action: 'notify',
          target: '',
          data: '{"level":"off"}',
          clientId: '',
          deadline: NOW + 60,
        },
        signature: '0xsig',
      })
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
