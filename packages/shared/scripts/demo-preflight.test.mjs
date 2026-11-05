import { describe, expect, it } from 'vitest';
import {
  balanceVerdict,
  followVerdict,
  formatReport,
  healthVerdict,
  lagVerdict,
  parseArgs,
} from './demo-preflight.mjs';

describe('lagVerdict', () => {
  it('passes when the subgraph is within a few blocks of the chain', () => {
    expect(lagVerdict({ subgraphBlock: 990, chainBlock: 1000, maxLag: 50 }).ok).toBe(true);
  });

  it('fails when the subgraph is far behind, saying how far', () => {
    const verdict = lagVerdict({ subgraphBlock: 500, chainBlock: 1000, maxLag: 50 });

    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain('500 blocks behind');
  });

  it('fails when the subgraph reports indexing errors, however close it is', () => {
    const verdict = lagVerdict({
      subgraphBlock: 1000,
      chainBlock: 1000,
      maxLag: 50,
      hasIndexingErrors: true,
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toMatch(/indexing errors/i);
  });
});

describe('balanceVerdict', () => {
  it('passes with enough ETH for the demo path', () => {
    expect(balanceVerdict({ wei: 500_000_000_000_000_000n, minEth: 0.2 }).ok).toBe(true);
  });

  it('fails below the minimum and shows the amount', () => {
    const verdict = balanceVerdict({ wei: 50_000_000_000_000_000n, minEth: 0.2 });

    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain('0.05');
  });
});

describe('healthVerdict', () => {
  it('passes only on an ok status', () => {
    expect(healthVerdict({ status: 200, body: { status: 'ok' } }).ok).toBe(true);
    expect(healthVerdict({ status: 200, body: { status: 'degraded' } }).ok).toBe(false);
    expect(healthVerdict({ status: 503, body: {} }).ok).toBe(false);
  });
});

describe('followVerdict', () => {
  it('passes when the follow graph answers', () => {
    expect(followVerdict({ status: 200 }).ok).toBe(true);
  });

  it('blames the API key, not Arkiv, for a 401', () => {
    const verdict = followVerdict({ status: 401 });

    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain('API_KEY');
  });

  it('points at the Arkiv keys for a server error', () => {
    const verdict = followVerdict({ status: 503 });

    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain('ARKIV');
  });
});

describe('parseArgs', () => {
  it('reads settings from the environment with sensible defaults', () => {
    const config = parseArgs({
      API_URL: 'https://api.example/',
      RELAYER_ADDRESS: '0xabc',
    });

    expect(config.apiUrl).toBe('https://api.example');
    expect(config.minRelayerEth).toBe(0.2);
    expect(config.maxLagBlocks).toBe(50);
  });

  it('refuses to run without an API URL or a relayer address', () => {
    expect(() => parseArgs({ RELAYER_ADDRESS: '0xabc' })).toThrow(/API_URL/);
    expect(() => parseArgs({ API_URL: 'https://x' })).toThrow(/RELAYER_ADDRESS/);
  });
});

describe('formatReport', () => {
  it('lists every check and fails overall if any fails', () => {
    const report = formatReport([
      { name: 'API health', ok: true, detail: 'ok' },
      { name: 'Relayer balance', ok: false, detail: '0.01 ETH' },
    ]);

    expect(report.ok).toBe(false);
    expect(report.text).toContain('PASS  API health');
    expect(report.text).toContain('FAIL  Relayer balance');
  });

  it('passes overall when everything passes', () => {
    expect(formatReport([{ name: 'a', ok: true, detail: '' }]).ok).toBe(true);
  });
});
