import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUBGRAPH_URL } from './subgraph';

// The app and the API stopped reading this subgraph when the contracts were redeployed (it indexes the
// previous deployment). The web pages keep it only until they read the Arkiv index (plan phase 3); this
// test makes the divergence explicit so it cannot be forgotten, and fails once the app's URL changes again.
describe('SUBGRAPH_URL', () => {
  it('is the legacy subgraph, no longer the one the app and API read', () => {
    const shared = readFileSync(
      join(process.cwd(), '../../packages/shared/src/constants.ts'),
      'utf8'
    );

    expect(SUBGRAPH_URL).toContain('/stryde/v0.6.0');
    expect(shared).not.toContain(SUBGRAPH_URL);
  });
});
