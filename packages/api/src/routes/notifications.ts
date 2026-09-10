import type { ExpoPushMessage } from 'expo-server-sdk';
import { Expo } from 'expo-server-sdk';
import { Hono } from 'hono';

export const notifications = new Hono();

interface PushMessageInput {
  to?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
  sound?: unknown;
  badge?: unknown;
  ttl?: unknown;
  priority?: unknown;
  channelId?: unknown;
}

interface PushResult {
  to: string;
  status: 'ok' | 'error';
  id?: string;
  message?: string;
}

// Expo's SDK works fine without an access token, but the FCM v1 (Android)
// path is more reliable/secure with one, and this API already treats
// EXPO_ACCESS_TOKEN as a configured secret (see .env.example). Mirror the
// apiKeyGate posture elsewhere in this API: fail closed in production if
// it's missing rather than silently degrading delivery, but allow local dev
// to proceed without one.
function getExpoClient(): Expo | { error: string } {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (!accessToken) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Push notifications not configured: missing EXPO_ACCESS_TOKEN' };
    }
    return new Expo();
  }
  return new Expo({ accessToken });
}

function normalizeMessages(body: Record<string, unknown>): PushMessageInput[] | null {
  if (Array.isArray(body.messages)) {
    const messages = body.messages.filter(
      (m): m is PushMessageInput => typeof m === 'object' && m !== null
    );
    return messages.length > 0 ? messages : null;
  }
  if (typeof body.to !== 'undefined') {
    return [body as PushMessageInput];
  }
  return null;
}

function buildMessageContent(raw: PushMessageInput, to: string): ExpoPushMessage {
  const message: ExpoPushMessage = { to };
  if (typeof raw.title === 'string') message.title = raw.title;
  if (typeof raw.body === 'string') message.body = raw.body;
  if (raw.data && typeof raw.data === 'object') {
    message.data = raw.data as Record<string, unknown>;
  }
  if (typeof raw.sound === 'string' || raw.sound === null) {
    message.sound = raw.sound as string | null;
  }
  if (typeof raw.badge === 'number') message.badge = raw.badge;
  if (typeof raw.ttl === 'number') message.ttl = raw.ttl;
  if (raw.priority === 'default' || raw.priority === 'normal' || raw.priority === 'high') {
    message.priority = raw.priority;
  }
  if (typeof raw.channelId === 'string') message.channelId = raw.channelId;
  return message;
}

notifications.post('/push', async (c) => {
  const expoOrError = getExpoClient();
  if (!(expoOrError instanceof Expo)) {
    console.error(`[notifications] ${expoOrError.error}`);
    return c.json({ error: expoOrError.error }, 503);
  }
  const expo = expoOrError;

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const rawMessages = normalizeMessages(body);
  if (!rawMessages) {
    return c.json({ error: 'messages array (or a single message with "to") is required' }, 400);
  }

  const results: PushResult[] = new Array(rawMessages.length);
  const validMessages: Array<{ index: number; message: ExpoPushMessage }> = [];

  rawMessages.forEach((raw, index) => {
    const to = raw.to;
    if (typeof to !== 'string') {
      results[index] = {
        to: typeof to === 'string' ? to : String(to ?? 'unknown'),
        status: 'error',
        message: 'Missing or invalid "to" push token',
      };
      return;
    }
    if (!Expo.isExpoPushToken(to)) {
      results[index] = {
        to,
        status: 'error',
        message: `"${to}" is not a valid Expo push token`,
      };
      return;
    }
    validMessages.push({ index, message: buildMessageContent(raw, to) });
  });

  if (validMessages.length > 0) {
    // chunkPushNotifications splits into Expo API-sized batches (<=100
    // messages each). It preserves input order, so we can walk the chunks
    // and the flat valid-message list in lockstep to map tickets/errors
    // back to the original request index.
    const chunks = expo.chunkPushNotifications(validMessages.map((v) => v.message));
    let cursor = 0;
    for (const chunk of chunks) {
      const chunkEntries = validMessages.slice(cursor, cursor + chunk.length);
      cursor += chunk.length;
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          const entry = chunkEntries[i];
          if (!entry) return;
          const to = entry.message.to as string;
          results[entry.index] =
            ticket.status === 'ok'
              ? { to, status: 'ok', id: ticket.id }
              : { to, status: 'error', message: ticket.message };
        });
      } catch (err) {
        // A network/API failure for this chunk shouldn't fail the other
        // chunks — record every message in this chunk as failed and continue.
        const message =
          err instanceof Error ? err.message : 'Failed to send push notification chunk';
        console.error('[notifications] Chunk send failed:', message);
        for (const entry of chunkEntries) {
          results[entry.index] = { to: entry.message.to as string, status: 'error', message };
        }
      }
    }
  }

  const success = results.filter((r) => r.status === 'ok').length;
  const failed = results.length - success;

  return c.json({
    results,
    summary: { total: results.length, success, failed },
  });
});
