import type { Handlers } from './outbox';

/**
 * Handlers for a profile with no backend (Sandbox): every intent counts as delivered, so the app
 * behaves as if the other side always said yes while the change stays applied on this device.
 */
export const ackAll: Handlers = new Proxy<Handlers>(
  {},
  {
    has: () => true,
    get: () => async () => {},
  }
);

/**
 * Like `ackAll`, except the listed kinds run their real handler: something on the device answers
 * them (the Sandbox's stand-in API), so they are delivered for real and can fail and retry.
 */
export function ackExcept(real: Handlers, kinds: readonly string[]): Handlers {
  const served = new Set(kinds);
  return new Proxy<Handlers>(
    {},
    {
      has: () => true,
      get: (_, kind) =>
        typeof kind === 'string' && served.has(kind) && real[kind] ? real[kind] : async () => {},
    }
  );
}
