import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectDeployment,
  parseBroadcast,
  pickLatest,
  rewriteApiConfig,
  rewriteConstants,
  rewriteManifest,
  TARGETS,
} from './sync-deployment.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');

const create = (contractName, contractAddress, block, hash = `0x${contractName}`) => ({
  tx: { transactionType: 'CREATE', contractName, contractAddress, hash },
  receipt: { transactionHash: hash, blockNumber: `0x${block.toString(16)}` },
});
const broadcast = (timestamp, creates) => ({
  timestamp,
  transactions: [
    ...creates.map((c) => c.tx),
    {
      transactionType: 'CALL',
      contractName: 'ProfileRegistry',
      contractAddress: '0xcall',
      hash: '0xcall',
    },
  ],
  receipts: creates.map((c) => c.receipt),
});

describe('parseBroadcast', () => {
  it('reads each deployed contract with its block, ignoring plain calls', () => {
    const entries = parseBroadcast(
      broadcast(5, [
        create('ProfileRegistry', '0xaaaa', 100),
        create('SeasonManager', '0xbbbb', 102),
      ])
    );

    expect(entries).toEqual([
      { name: 'ProfileRegistry', address: '0xaaaa', block: 100, timestamp: 5 },
      { name: 'SeasonManager', address: '0xbbbb', block: 102, timestamp: 5 },
    ]);
  });
});

describe('pickLatest', () => {
  it('keeps the newest deployment of each contract, and the earliest block as the deploy block', () => {
    const { contracts, deployBlock } = pickLatest([
      { name: 'ProfileRegistry', address: '0xold', block: 50, timestamp: 1 },
      { name: 'ProfileRegistry', address: '0xnew', block: 200, timestamp: 9 },
      { name: 'SeasonManager', address: '0xsm', block: 201, timestamp: 9 },
    ]);

    expect(contracts).toEqual({ profileRegistry: '0xnew', seasonManager: '0xsm' });
    // The stale deployment's block 50 must not drag the start block back.
    expect(deployBlock).toBe(200);
  });
});

const CONSTANTS = `
const CONFIGS = {
  'ethereum-sepolia': {
    deployBlock: 100n,
    contracts: {
      profileRegistry: '0x1111111111111111111111111111111111111111',
      seasonManager: '0x2222222222222222222222222222222222222222',
    },
  },
  'base-sepolia': {
    deployBlock: 7n,
    contracts: {
      profileRegistry: '0x3333333333333333333333333333333333333333',
    },
  },
};`;
const NEW = {
  profileRegistry: '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa',
  seasonManager: '0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb',
};

describe('rewriteConstants', () => {
  it('updates the Sepolia addresses and deploy block, and nothing in another chain', () => {
    const out = rewriteConstants(CONSTANTS, NEW, 250);

    expect(out).toContain("profileRegistry: '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa'");
    expect(out).toContain("seasonManager: '0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb'");
    expect(out).toContain('deployBlock: 250n');
    expect(out).toContain("profileRegistry: '0x3333333333333333333333333333333333333333'");
    expect(out).toContain('deployBlock: 7n');
  });

  it('is a no-op when nothing changed', () => {
    const same = {
      profileRegistry: '0x1111111111111111111111111111111111111111',
      seasonManager: '0x2222222222222222222222222222222222222222',
    };

    expect(rewriteConstants(CONSTANTS, same, 100)).toBe(CONSTANTS);
  });
});

describe('rewriteApiConfig', () => {
  const API = `export const SEPOLIA_CONTRACTS = {
  profileRegistry: '0x1111111111111111111111111111111111111111',
  seasonManager: '0x2222222222222222222222222222222222222222',
};
export const LOCAL_CONTRACTS = {
  profileRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
};
const x = { 11155111: { deployBlock: 11_697_363n, subgraphUrl: 'u' }, 31337: { deployBlock: 0n } };`;

  it('updates only the Sepolia table and its deploy block (underscored)', () => {
    const out = rewriteApiConfig(API, NEW, 11_700_000);

    expect(out).toContain("profileRegistry: '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa'");
    expect(out).toContain('deployBlock: 11_700_000n');
    expect(out).toContain("'0x5FbDB2315678afecb367f032d93F642f64180aa3'");
    expect(out).toContain('31337: { deployBlock: 0n }');
  });
});

describe('rewriteManifest', () => {
  const YAML = `dataSources:
  - kind: ethereum/contract
    name: ProfileRegistry
    network: sepolia
    source:
      address: "0x1111111111111111111111111111111111111111"
      abi: ProfileRegistry
      startBlock: 100
  - kind: ethereum/contract
    name: SeasonManager
    network: sepolia
    source:
      address: "0x2222222222222222222222222222222222222222"
      abi: SeasonManager
      startBlock: 100
`;

  it('points every source at its new address and start block', () => {
    const out = rewriteManifest(YAML, NEW, 250);

    expect(out).toContain('address: "0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa"');
    expect(out).toContain('address: "0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb"');
    expect(out.match(/startBlock: 250/g)).toHaveLength(2);
  });

  it('leaves a data source alone when the deployment does not mention it', () => {
    const out = rewriteManifest(YAML, { profileRegistry: NEW.profileRegistry }, 250);

    expect(out).toContain('address: "0x2222222222222222222222222222222222222222"');
  });
});

describe('against this repository', () => {
  it('finds the live Sepolia deployment, and rewriting the files with it changes nothing', () => {
    const { contracts, deployBlock } = collectDeployment(
      join(repo, 'packages/contracts/broadcast'),
      11155111
    );

    expect(Object.keys(contracts).length).toBeGreaterThanOrEqual(11);
    for (const target of TARGETS) {
      const source = readFileSync(join(repo, target.file), 'utf8');
      expect(target.rewrite(source, contracts, deployBlock), target.file).toBe(source);
    }
  });
});
