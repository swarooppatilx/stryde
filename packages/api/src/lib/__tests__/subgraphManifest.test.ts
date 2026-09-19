import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Imported from source, like chainConfig.test.ts: the address table is the one canonical copy.
import { getChainConfig } from '../../../../shared/src/constants.js';

const manifest = readFileSync(
  join(import.meta.dirname, '../../../../subgraph/subgraph.yaml'),
  'utf8'
);

interface Source {
  name: string;
  address: string;
  startBlock: number;
}

/** The manifest's data sources, read with a regex rather than a YAML dependency. */
const sources: Source[] = manifest
  .split(/\n {2}- kind: ethereum\/contract\n/)
  .slice(1)
  .map((block) => ({
    name: /name: (\w+)/.exec(block)?.[1] ?? '',
    address: /address: "(0x[0-9a-fA-F]{40})"/.exec(block)?.[1] ?? '',
    startBlock: Number(/startBlock: (\d+)/.exec(block)?.[1]),
  }));

const camel = (name: string) => name[0]?.toLowerCase() + name.slice(1);

describe('subgraph manifest matches the deployed contracts in constants.ts', () => {
  const sepolia = getChainConfig('ethereum-sepolia');

  it('indexes every deployed contract, once', () => {
    const indexed = sources.map((s) => camel(s.name)).sort();

    expect(indexed).toEqual(Object.keys(sepolia.contracts).sort());
  });

  it.each(sources)('$name is at the address the app and relayer use', ({ name, address }) => {
    const expected = sepolia.contracts[camel(name) as keyof typeof sepolia.contracts];

    expect(address.toLowerCase()).toBe(expected.toLowerCase());
  });

  it('starts every source at the deployment block, so no event is missed or scanned for nothing', () => {
    for (const source of sources) expect(source.startBlock).toBe(Number(sepolia.deployBlock));
  });
});
