import { beforeEach, describe, expect, it, vi } from 'vitest';

const share = vi.fn();
const fail = vi.fn();
const warn = vi.fn();
vi.mock('react-native', () => ({ Share: { share: (...args: unknown[]) => share(...args) } }));
vi.mock('@/utils/toast', () => ({ Toast: { fail: (...args: unknown[]) => fail(...args) } }));
vi.mock('@/utils/logger', () => ({ logger: { warn: (...args: unknown[]) => warn(...args) } }));

const { shareMessage } = await import('@/utils/shareMessage');

beforeEach(() => {
  share.mockReset();
  fail.mockReset();
  warn.mockReset();
});

describe('shareMessage', () => {
  it('opens the system share sheet with the message and stays quiet when it works', async () => {
    share.mockResolvedValue({ action: 'sharedAction' });

    await shareMessage('Asha on Stryde', 'Could not share this profile');

    expect(share).toHaveBeenCalledWith({ message: 'Asha on Stryde' });
    expect(fail).not.toHaveBeenCalled();
  });

  it('tells the athlete in the words the screen chose, and logs why, when the sheet cannot open', async () => {
    const error = new Error('no share targets');
    share.mockRejectedValue(error);

    await expect(shareMessage('hi', 'Could not share your profile')).resolves.toBeUndefined();

    expect(fail).toHaveBeenCalledWith('Could not share your profile', expect.any(Number));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Share'), error);
  });
});
