import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Relative import, not @repo/shared: the api package doesn't depend on shared
// at runtime, and this test only needs the canonical address table.
import { getChainConfig } from '../../../../shared/src/constants.js';
import { LOCAL_CONTRACTS, SEPOLIA_CONTRACTS } from '../chainConfig.js';

describe('relayer address maps match packages/shared', () => {
  it('sepolia', () => {
    expect(SEPOLIA_CONTRACTS).toEqual(getChainConfig('ethereum-sepolia').contracts);
  });

  it('local (anvil)', () => {
    expect(LOCAL_CONTRACTS).toEqual(getChainConfig('local').contracts);
  });
});

describe('the relayer reads the same subgraph and deploy block as packages/shared', () => {
  const source = readFileSync(join(import.meta.dirname, '../chainConfig.ts'), 'utf8');
  const sepolia = getChainConfig('ethereum-sepolia');

  it('subgraph URL', () => {
    expect(source).toContain(`subgraphUrl: '${sepolia.subgraphUrl}'`);
  });

  it('deploy block', () => {
    const block = Number(
      /11155111: \{[\s\S]*?deployBlock: ([\d_]+)n/.exec(source)?.[1]?.replaceAll('_', '')
    );

    expect(block).toBe(Number(sepolia.deployBlock));
  });
});
