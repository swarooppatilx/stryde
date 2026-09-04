import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPE_BY_ID, ACTIVITY_TYPE_MAP, getChainConfig } from '../../constants';

describe('ACTIVITY_TYPE_MAP', () => {
  it('maps run to 0', () => {
    expect(ACTIVITY_TYPE_MAP.run).toBe(0);
  });

  it('maps ride to 1', () => {
    expect(ACTIVITY_TYPE_MAP.ride).toBe(1);
  });

  it('maps walk to 2', () => {
    expect(ACTIVITY_TYPE_MAP.walk).toBe(2);
  });

  it('maps hike to 3', () => {
    expect(ACTIVITY_TYPE_MAP.hike).toBe(3);
  });
});

describe('ACTIVITY_TYPE_BY_ID', () => {
  it('maps 0 to run', () => {
    expect(ACTIVITY_TYPE_BY_ID[0]).toBe('run');
  });

  it('maps 1 to ride', () => {
    expect(ACTIVITY_TYPE_BY_ID[1]).toBe('ride');
  });

  it('maps 2 to walk', () => {
    expect(ACTIVITY_TYPE_BY_ID[2]).toBe('walk');
  });

  it('maps 3 to hike', () => {
    expect(ACTIVITY_TYPE_BY_ID[3]).toBe('hike');
  });
});

describe('getChainConfig', () => {
  it('returns ethereum-sepolia config', () => {
    const config = getChainConfig('ethereum-sepolia');
    expect(config.chainId).toBe(11155111);
    expect(config.rpcUrl).toBe('https://rpc.ankr.com/eth_sepolia');
  });

  it('returns base-sepolia config', () => {
    const config = getChainConfig('base-sepolia');
    expect(config.chainId).toBe(84532);
    expect(config.rpcUrl).toBe('https://sepolia.base.org');
  });

  it('returns local config', () => {
    const config = getChainConfig('local');
    expect(config.chainId).toBe(31337);
    expect(config.rpcUrl).toBe('http://127.0.0.1:8545');
  });
});
