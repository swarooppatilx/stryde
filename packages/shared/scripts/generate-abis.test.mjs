import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'generate-abis.mjs');

describe('generated ABIs', () => {
  it('match packages/contracts/src/abis (run `yarn workspace @repo/shared generate:abis` after changing a contract)', () => {
    const result = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
