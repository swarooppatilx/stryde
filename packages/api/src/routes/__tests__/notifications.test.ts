import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPushNotificationsAsync, chunkPushNotifications, isExpoPushToken } = vi.hoisted(() => {
  return {
    sendPushNotificationsAsync: vi.fn(),
    // Mirrors the real chunkPushNotifications behavior closely enough for
    // these tests: a single chunk containing every message (well under the
    // real 100-message limit).
    chunkPushNotifications: vi.fn((messages: unknown[]) => (messages.length ? [messages] : [])),
    isExpoPushToken: vi.fn(
      (token: unknown) => typeof token === 'string' && token.startsWith('ExponentPushToken[')
    ),
  };
});

vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken = isExpoPushToken;
    chunkPushNotifications = chunkPushNotifications;
    sendPushNotificationsAsync = sendPushNotificationsAsync;
  }
  return { Expo };
});

const { notifications } = await import('../notifications.js');

const VALID_TOKEN = 'ExponentPushToken[valid-token-1]';

describe('POST /notifications/push', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAccessToken = process.env.EXPO_ACCESS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    isExpoPushToken.mockImplementation(
      (token: unknown) => typeof token === 'string' && token.startsWith('ExponentPushToken[')
    );
    chunkPushNotifications.mockImplementation((messages: unknown[]) =>
      messages.length ? [messages] : []
    );
    process.env.NODE_ENV = 'test';
    process.env.EXPO_ACCESS_TOKEN = 'test-expo-access-token';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.EXPO_ACCESS_TOKEN = originalAccessToken;
  });

  it('sends a push notification to a valid token and returns the ticket', async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([{ status: 'ok', id: 'receipt-1' }]);

    const res = await notifications.request('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: VALID_TOKEN, title: 'Hello', body: 'World' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      results: [{ to: VALID_TOKEN, status: 'ok', id: 'receipt-1' }],
      summary: { total: 1, success: 1, failed: 0 },
    });
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
      expect.objectContaining({ to: VALID_TOKEN, title: 'Hello', body: 'World' }),
    ]);
  });

  it('rejects an invalid Expo push token without calling the Expo SDK', async () => {
    const res = await notifications.request('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'not-a-real-token', title: 'Hello' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([
      {
        to: 'not-a-real-token',
        status: 'error',
        message: '"not-a-real-token" is not a valid Expo push token',
      },
    ]);
    expect(json.summary).toEqual({ total: 1, success: 0, failed: 1 });
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('isolates a chunk-level send failure without crashing the request', async () => {
    sendPushNotificationsAsync.mockRejectedValueOnce(new Error('network down'));

    const res = await notifications.request('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ to: VALID_TOKEN, title: 'Hello' }] }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([{ to: VALID_TOKEN, status: 'error', message: 'network down' }]);
    expect(json.summary).toEqual({ total: 1, success: 0, failed: 1 });
  });

  it('handles a mix of valid and invalid tokens in one batch', async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([{ status: 'ok', id: 'receipt-2' }]);

    const res = await notifications.request('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ to: 'bad-token' }, { to: VALID_TOKEN, title: 'Hi' }],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0]).toMatchObject({ to: 'bad-token', status: 'error' });
    expect(json.results[1]).toEqual({ to: VALID_TOKEN, status: 'ok', id: 'receipt-2' });
    expect(json.summary).toEqual({ total: 2, success: 1, failed: 1 });
    // Only the valid token should ever reach the Expo SDK.
    expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
      expect.objectContaining({ to: VALID_TOKEN }),
    ]);
  });

  it('rejects a request with no messages', async () => {
    const res = await notifications.request('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('fails loudly in production when EXPO_ACCESS_TOKEN is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EXPO_ACCESS_TOKEN = '';

    const res = await notifications.request('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: VALID_TOKEN }),
    });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/EXPO_ACCESS_TOKEN/);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});
