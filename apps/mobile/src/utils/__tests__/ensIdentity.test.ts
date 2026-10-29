import { describe, expect, it } from 'vitest';
import { chooseEnsIdentity } from '@/utils/ensIdentity';

describe('chooseEnsIdentity', () => {
  it('shows nothing when no name resolved', () => {
    expect(
      chooseEnsIdentity({ ensName: null, ensAvatar: 'https://x.test/a.png', hasOwnAvatar: false })
    ).toEqual({ ensLine: null, fallbackAvatar: null });
  });

  it('shows the name, trimmed, and ignores a blank one', () => {
    expect(
      chooseEnsIdentity({ ensName: ' ana.eth ', ensAvatar: null, hasOwnAvatar: true }).ensLine
    ).toBe('ana.eth');
    expect(chooseEnsIdentity({ ensName: '  ', ensAvatar: null, hasOwnAvatar: true }).ensLine).toBe(
      null
    );
  });

  it('uses the name avatar only when the athlete has no uploaded one', () => {
    const input = { ensName: 'ana.eth', ensAvatar: 'https://x.test/a.png' };
    expect(chooseEnsIdentity({ ...input, hasOwnAvatar: false }).fallbackAvatar).toBe(
      'https://x.test/a.png'
    );
    expect(chooseEnsIdentity({ ...input, hasOwnAvatar: true }).fallbackAvatar).toBeNull();
  });

  it('refuses an avatar that is not a web address, and one without a verified name', () => {
    expect(
      chooseEnsIdentity({
        ensName: 'ana.eth',
        ensAvatar: 'data:image/png;base64,AA',
        hasOwnAvatar: false,
      }).fallbackAvatar
    ).toBeNull();
    expect(
      chooseEnsIdentity({ ensName: null, ensAvatar: 'https://x.test/a.png', hasOwnAvatar: false })
        .fallbackAvatar
    ).toBeNull();
  });
});
