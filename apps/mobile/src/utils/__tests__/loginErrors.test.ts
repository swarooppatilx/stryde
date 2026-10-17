import { describe, expect, it } from 'vitest';
import { describeLoginFailure, isPlausibleEmail } from '@/utils/loginErrors';

describe('describeLoginFailure', () => {
  it('blames the connection, not the code, when the network is down', () => {
    const offline = new Error('Network request failed');

    expect(describeLoginFailure(offline, 'verify')).toMatch(/connection/i);
    expect(describeLoginFailure(offline, 'send')).toMatch(/connection/i);
  });

  it('tells the athlete to wait when they are rate limited', () => {
    expect(describeLoginFailure(new Error('Too many requests'), 'send')).toMatch(/wait/i);
  });

  it('says a wrong or expired code did not work, and how to recover', () => {
    const message = describeLoginFailure(new Error('Invalid or expired code'), 'verify');

    expect(message).toMatch(/code didn't work/i);
    expect(message).toMatch(/new one/i);
  });

  it('never shows a raw technical message', () => {
    const raw = new Error('PrivyApiError: 500 internal at /api/v1/passwordless/init');

    expect(describeLoginFailure(raw, 'send')).toBe("Couldn't send the code. Try again.");
    expect(describeLoginFailure(raw, 'verify')).toBe("Couldn't verify the code. Try again.");
    expect(describeLoginFailure('boom', 'send')).not.toMatch(/boom/);
  });
});

describe('isPlausibleEmail', () => {
  it.each(['a@b.co', 'first.last+tag@mail.example.com', ' me@x.io '])('accepts %s', (email) => {
    expect(isPlausibleEmail(email)).toBe(true);
  });

  it.each(['', 'me', 'me@', '@x.io', 'me@x', 'me @x.io', 'me@x..io'])('rejects %j', (email) => {
    expect(isPlausibleEmail(email)).toBe(false);
  });
});
