import type { Address } from './address.js';
import { logError } from './logError.js';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_BATCH_SIZE = 100;
/** The request that caused a push waits for it, so a slow Expo must not hold that request for long. */
const PUSH_TIMEOUT_MS = 5_000;

export interface PushMessage {
  title: string;
  body: string;
  /** What the app needs to open the right screen: `kind` plus the id it concerns. */
  data: Record<string, string>;
  /** The Android channel the app created for this kind of message. */
  channelId?: 'social' | 'recording';
}

export interface PushTokenDirectory {
  tokensFor(owner: Address): Promise<string[]>;
  /** Drops a token that no device answers to any more. */
  forget(token: string): Promise<void>;
}

export interface PushSenderDeps {
  fetch: typeof fetch;
  tokens: PushTokenDirectory;
  accessToken?: string;
}

interface Ticket {
  status?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

function readTickets(payload: unknown): Ticket[] {
  const data = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Ticket[]) : [];
}

export function createPushSender({ fetch: doFetch, tokens, accessToken }: PushSenderDeps) {
  const sendBatch = async (batch: string[], message: PushMessage) => {
    const response = await doFetch(EXPO_PUSH_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(
        batch.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data,
          channelId: message.channelId ?? 'social',
          sound: 'default',
        }))
      ),
    });
    if (!response.ok) throw new Error(`Expo push answered ${response.status}`);
    const tickets = readTickets(await response.json());
    // Tickets come back in the order the messages were sent.
    await Promise.all(
      tickets.map((ticket, i) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && batch[i]
          ? tokens.forget(batch[i])
          : undefined
      )
    );
  };

  return {
    /** Delivers to every device the person registered; a failing batch is logged and the rest still go out. */
    async send(owner: Address, message: PushMessage): Promise<void> {
      const registered = await tokens.tokensFor(owner);
      for (const batch of chunk(registered, EXPO_BATCH_SIZE)) {
        try {
          await sendBatch(batch, message);
        } catch (error) {
          logError('[push] Sending a batch failed', error);
        }
      }
    },

    /** For the request that caused the message: never throws, so a push problem cannot fail it. */
    async notify(owner: Address, message: PushMessage): Promise<void> {
      try {
        await this.send(owner, message);
      } catch (error) {
        logError('[push] Notifying failed', error);
      }
    },
  };
}

export type PushSender = ReturnType<typeof createPushSender>;
