import { afterEach, describe, expect, it } from 'vitest';
import { isProduction } from '../env.js';

const KEYS = ['NODE_ENV', 'VERCEL_ENV'] as const;
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

function setEnv(env: { NODE_ENV?: string; VERCEL_ENV?: string }) {
  for (const k of KEYS) {
    const value = env[k];
    if (value === undefined) delete process.env[k];
    else process.env[k] = value;
  }
}

describe('isProduction', () => {
  it.each([
    [{ NODE_ENV: 'production' }, true],
    [{ VERCEL_ENV: 'production' }, true],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'preview' }, true],
    [{ NODE_ENV: 'development', VERCEL_ENV: 'production' }, true],
    [{ NODE_ENV: 'development' }, false],
    [{ VERCEL_ENV: 'preview' }, false],
    [{}, false],
  ])('%j -> %s', (env, expected) => {
    setEnv(env);

    expect(isProduction()).toBe(expected);
  });
});
