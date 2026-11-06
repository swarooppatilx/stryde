import type { ExpoPushMessage } from 'expo-server-sdk';
import { Expo } from 'expo-server-sdk';
import { Hono } from 'hono';
import { isProduction } from '../lib/env.js';
import { logError } from '../lib/logError.js';
import { invalidJsonBody, limitBody, readJsonObject } from '../middleware/jsonBody.js';

export const notifications = new Hono();

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_MESSAGES = 100;
const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 1000;

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

// Fails closed in production without an access token; development may run without one.
function getExpoClient(): Expo | { error: string } {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (!accessToken) {
    if (isProduction()) {
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

function textLimitError(raw: PushMessageInput): string | null {
  if (typeof raw.title === 'string' && raw.title.length > MAX_TITLE_LENGTH) {
    return `title is longer than ${MAX_TITLE_LENGTH} characters`;
  }
  if (typeof raw.body === 'string' && raw.body.length > MAX_BODY_LENGTH) {
    return `body is longer than ${MAX_BODY_LENGTH} characters`;
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

notifications.post('/push', limitBody(MAX_REQUEST_BYTES), async (c) => {
  const expoOrError = getExpoClient();
  if (!(expoOrError instanceof Expo)) {
    logError('[notifications] Service misconfigured:', expoOrError.error);
    return c.json({ error: 'Service misconfigured' }, 503);
  }
  const expo = expoOrError;

  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);

  const rawMessages = normalizeMessages(body);
  if (!rawMessages) {
    return c.json({ error: 'messages array (or a single message with "to") is required' }, 400);
  }

  if (rawMessages.length > MAX_MESSAGES) {
    return c.json({ error: `At most ${MAX_MESSAGES} messages per request` }, 400);
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
    const textError = textLimitError(raw);
    if (textError) {
      results[index] = { to, status: 'error', message: textError };
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
    // chunkPushNotifications splits into Expo-sized batches (<=100) in input order, so chunks and the flat valid-message list are walked in lockstep to map tickets/errors back to request indexes.
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
        // A chunk's network/API failure must not fail the other chunks; mark its messages failed and continue.
        const message =
          err instanceof Error ? err.message : 'Failed to send push notification chunk';
        logError('[notifications] Chunk send failed:', err);
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
