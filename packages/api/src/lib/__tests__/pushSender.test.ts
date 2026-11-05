import { describe, expect, it, vi } from 'vitest';
import { createPushSender, EXPO_PUSH_URL } from '../pushSender.js';

const OWNER = '0x00000000000000000000000000000000000000aa' as const;
const token = (n: number) => `ExponentPushToken[token-${n}]`;

function setup(tokens: string[], respond?: (messages: { to: string }[]) => unknown) {
  const forgotten: string[] = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const messages = JSON.parse(String(init?.body)) as { to: string }[];
    const data = respond
      ? respond(messages)
      : messages.map((_, i) => ({ status: 'ok', id: `t${i}` }));
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  const sender = createPushSender({
    fetch: fetchMock as unknown as typeof fetch,
    tokens: {
      tokensFor: async () => tokens,
      forget: async (t) => {
        forgotten.push(t);
      },
    },
    accessToken: 'secret-access',
  });
  return { sender, fetchMock, forgotten };
}

const message = {
  title: 'New follower',
  body: 'Someone followed you',
  data: { kind: 'newFollower' },
};

describe('createPushSender', () => {
  it('posts one message per device to the Expo push endpoint', async () => {
    const { sender, fetchMock } = setup([token(1), token(2)]);

    await sender.send(OWNER, message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(EXPO_PUSH_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-access');
    const body = JSON.parse(String(init.body));
    expect(body.map((m: { to: string }) => m.to)).toEqual([token(1), token(2)]);
    expect(body[0]).toMatchObject({
      title: 'New follower',
      channelId: 'social',
      data: { kind: 'newFollower' },
    });
  });

  it('sends nothing when the person has no registered device', async () => {
    const { sender, fetchMock } = setup([]);

    await sender.send(OWNER, message);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('splits more than 100 devices into batches of 100', async () => {
    const tokens = Array.from({ length: 230 }, (_, i) => token(i));
    const { sender, fetchMock } = setup(tokens);

    await sender.send(OWNER, message);

    const sizes = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).length);
    expect(sizes).toEqual([100, 100, 30]);
  });

  it('deletes a token Expo reports as DeviceNotRegistered', async () => {
    const { sender, forgotten } = setup([token(1), token(2)], () => [
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: 'x' },
    ]);

    await sender.send(OWNER, message);

    expect(forgotten).toEqual([token(1)]);
  });

  it('keeps tokens whose error is not DeviceNotRegistered', async () => {
    const { sender, forgotten } = setup([token(1)], () => [
      { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
    ]);

    await sender.send(OWNER, message);

    expect(forgotten).toEqual([]);
  });

  it('keeps sending later batches when one batch fails', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => token(i));
    const { sender, fetchMock } = setup(tokens);
    fetchMock.mockRejectedValueOnce(new Error('network'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await sender.send(OWNER, message);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('notify never throws, even when looking up devices fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sender = createPushSender({
      fetch: vi.fn() as unknown as typeof fetch,
      tokens: {
        tokensFor: async () => {
          throw new Error('arkiv down');
        },
        forget: async () => {},
      },
    });

    await expect(sender.notify(OWNER, message)).resolves.toBeUndefined();
  });
});
