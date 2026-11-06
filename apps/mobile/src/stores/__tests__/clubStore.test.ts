import { describe, expect, it } from 'vitest';
import { applyChange, type ClubView } from '@/stores/clubStore';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const view: ClubView = {
  state: {
    clubId: '1',
    owner: ME,
    settings: {
      name: '',
      location: '',
      description: '',
      photo: '',
      cover: '',
      inviteOnly: false,
      adminsOnlyPost: false,
      showLeaderboard: true,
    },
    admins: [],
    removed: [],
    requests: [{ member: '0x00000000000000000000000000000000000000bb', status: 'pending', at: 1 }],
    events: [],
  },
  feed: [],
  loading: false,
  error: null,
};

describe('applyChange', () => {
  it('shows a new post at the top straight away', () => {
    const next = applyChange(
      view,
      { clubId: '1', action: 'post', data: { text: 'hi' }, clientId: 'x' },
      ME
    );
    expect(next.feed?.[0]).toMatchObject({ id: 'local-x', text: 'hi', author: ME });
  });

  it('approves a request and makes an admin', () => {
    const decided = applyChange(
      view,
      {
        clubId: '1',
        action: 'decide',
        target: '0x00000000000000000000000000000000000000bb',
        data: { approve: true },
      },
      ME
    );
    expect(decided.state?.requests[0]?.status).toBe('approved');
    const admin = applyChange(
      view,
      {
        clubId: '1',
        action: 'set-role',
        target: '0x00000000000000000000000000000000000000cc',
        data: { role: 'admin' },
      },
      ME
    );
    expect(admin.state?.admins).toEqual(['0x00000000000000000000000000000000000000cc']);
  });

  it('turns invite-only on in the settings', () => {
    expect(
      applyChange(
        view,
        { clubId: '1', action: 'settings', data: { ...view.state?.settings, inviteOnly: true } },
        ME
      ).state?.settings.inviteOnly
    ).toBe(true);
  });
});
