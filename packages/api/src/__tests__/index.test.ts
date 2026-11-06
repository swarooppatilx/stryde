import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/fileFetchShim.js', () => ({ installFileFetchShim: () => {} }));

let app: Awaited<typeof import('../index.js')>['default'];
const original = process.env.API_KEY;

beforeAll(async () => {
  process.env.API_KEY = 'test-key-123456';
  app = (await import('../index.js')).default;
});
afterAll(() => {
  if (original === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = original;
});

const asks = (path: string, headers: Record<string, string> = {}) =>
  app.request(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  });

describe('who may call what', () => {
  it.each([
    '/ipfs/upload',
    '/activities/validate',
    '/social/follow',
    '/push/register',
    '/routing/route',
    '/world/session',
  ])('%s needs the app API key', async (path) => {
    expect((await asks(path)).status).toBe(401);
    expect((await asks(path, { 'X-API-Key': 'wrong' })).status).toBe(401);
  });

  it('relay and maintenance guard themselves, so the key alone is not what opens them', async () => {
    expect((await asks('/relay/mint-reward')).status).toBe(401);
    expect((await asks('/maintenance/index')).status).toBe(401);
  });

  it('the health check is open', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });
});
