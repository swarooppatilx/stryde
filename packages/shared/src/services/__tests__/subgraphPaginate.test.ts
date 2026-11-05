import { afterEach, describe, expect, it, vi } from 'vitest';
import { paginate } from '../subgraphPaginate';

const URL = 'https://subgraph.test/q';

function respondWith(pages: Array<Array<{ id: string }>>) {
  const bodies: Array<{ query: string; variables: Record<string, unknown> }> = [];
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    const page = pages[bodies.length - 1] ?? [];
    return new Response(JSON.stringify({ data: { things: page } }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return bodies;
}

const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `0x${(from + i).toString(16).padStart(4, '0')}`,
  }));

afterEach(() => vi.unstubAllGlobals());

describe('paginate', () => {
  it('walks a collection by id cursor and stops at the first short page', async () => {
    const bodies = respondWith([ids(0, 3), ids(3, 3), ids(6, 1)]);

    const rows = await paginate<{ id: string }>({
      url: URL,
      collection: 'things',
      idType: 'Bytes',
      selection: 'id',
      pageSize: 3,
    });

    expect(rows).toHaveLength(7);
    expect(bodies).toHaveLength(3);
    expect(bodies[0]?.variables).toEqual({ first: 3 });
    expect(bodies[1]?.variables).toEqual({ first: 3, lastId: '0x0002' });
    expect(bodies[2]?.variables).toEqual({ first: 3, lastId: '0x0005' });
  });

  it('never uses skip, which the indexer rejects beyond 5000', async () => {
    const bodies = respondWith([ids(0, 1000), ids(1000, 1000), []]);

    await paginate({
      url: URL,
      collection: 'things',
      idType: 'Bytes',
      selection: 'id',
      pageSize: 1000,
    });

    for (const body of bodies) expect(body.query).not.toMatch(/skip/);
  });

  it('keeps the caller’s filter on every page', async () => {
    const bodies = respondWith([ids(0, 2), []]);

    await paginate({
      url: URL,
      collection: 'things',
      idType: 'String',
      selection: 'id',
      where: 'active: true',
      pageSize: 2,
    });

    for (const body of bodies) expect(body.query).toContain('active: true');
    expect(bodies[1]?.query).toContain('id_gt: $lastId');
    expect(bodies[1]?.query).toContain('$lastId: String!');
    expect(bodies[0]?.query).not.toContain('id_gt');
  });

  it('rejects on an HTTP failure or a GraphQL error instead of returning a partial list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 502 }))
    );
    await expect(
      paginate({ url: URL, collection: 'things', idType: 'Bytes', selection: 'id' })
    ).rejects.toThrow('502');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'bad field' }] })))
    );
    await expect(
      paginate({ url: URL, collection: 'things', idType: 'Bytes', selection: 'id' })
    ).rejects.toThrow('bad field');
  });
});
