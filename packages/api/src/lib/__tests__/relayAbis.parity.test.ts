import { describe, expect, it } from 'vitest';
import { ABIS } from '../../../../shared/src/abis.js';
import { RELAY_ABIS } from '../relayAbis.js';

type Entry = {
  type: string;
  name?: string;
  inputs?: Array<{ type: string; components?: unknown[] }>;
};

/** `name(type,type)` with tuples spelled out, so two entries are equal exactly when they would hash alike. */
function signature(entry: Entry): string {
  const types = (entry.inputs ?? []).map((input) => typeOf(input));
  return `${entry.type}:${entry.name ?? ''}(${types.join(',')})`;
}

function typeOf(input: { type: string; components?: unknown[] }): string {
  if (!input.type.startsWith('tuple')) return input.type;
  const inner = (input.components as Array<{ type: string; components?: unknown[] }>).map(typeOf);
  return `(${inner.join(',')})${input.type.slice('tuple'.length)}`;
}

/** Declared on every relayed contract on purpose, so viem can name these reverts wherever they come from. */
const GENERIC_ERRORS = new Set([
  'error:OwnableUnauthorizedAccount(address)',
  'error:AccessControlUnauthorizedAccount(address,bytes32)',
  'error:EnforcedPause()',
  'error:ZeroAddress()',
]);

describe('the relay API ABIs agree with the generated ones', () => {
  for (const [name, relayAbi] of Object.entries(RELAY_ABIS)) {
    it(`${name}: every function, event and error it declares exists on the real contract`, () => {
      const real = new Set(
        (ABIS[name as keyof typeof ABIS] as unknown as readonly Entry[]).map(signature)
      );
      const missing = (relayAbi as readonly Entry[])
        .filter((entry) => ['function', 'event', 'error'].includes(entry.type))
        .map(signature)
        .filter((sig) => !real.has(sig) && !GENERIC_ERRORS.has(sig));

      // A signature the contract no longer has makes the relayer send calls (or decode reverts) that cannot work.
      expect(missing).toEqual([]);
    });
  }
});
