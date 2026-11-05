import { afterEach, describe, expect, it, vi } from 'vitest';
import { querySubgraph } from '../subgraphClient';

const URL = 'https://api.example.com/graphql';

describe('querySubgraph', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the query and hands back the data', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { activities: [{ id: '1' }] } }), { status: 200 })
      );

    const data = await querySubgraph<{ activities: { id: string }[] }>(
      URL,
      'query { activities { id } }'
    );

    expect(data.activities).toEqual([{ id: '1' }]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(sent.query).toContain('activities');
  });

  it('gives up on a hung indexer rather than hanging its caller forever', async () => {
    vi.useFakeTimers();
    try {
      // Settle only when the abort signal fires, like a real fetch on a dead socket.
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          })
      );

      const pending = querySubgraph(URL, 'query { x }');
      pending.catch(() => {}); // keep advancing timers from logging an unhandled rejection
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(pending).rejects.toThrow(/timed out/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces a GraphQL error instead of returning half a response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 200 })
    );

    await expect(querySubgraph(URL, '{ x }')).rejects.toThrow('boom');
  });
});
