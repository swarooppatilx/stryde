import { describe, expect, it } from 'vitest';
import { ackAll, ackExcept } from '@/backends/outbox/ackHandlers';
import { createOutbox } from '@/backends/outbox/outbox';
import { FakeClock, MemoryStorage, SequentialIds } from '@/platform/fakes';

describe('ackAll', () => {
  it('delivers any kind of intent by acknowledging it, so nothing waits on a service that is not there', async () => {
    const outbox = createOutbox({
      storage: new MemoryStorage(),
      clock: new FakeClock(),
      ids: new SequentialIds(),
      handlers: ackAll,
      isOnline: () => true,
      onRejected: () => {},
    });

    await outbox.enqueue({ kind: 'setKudos', payload: {} });
    await outbox.enqueue({ kind: 'anythingElse', payload: {} });
    await outbox.drain();

    expect(outbox.entries()).toEqual([]);
  });
});

describe('ackExcept', () => {
  const outboxWith = (handlers: Parameters<typeof ackExcept>[0], kinds: string[]) =>
    createOutbox({
      storage: new MemoryStorage(),
      clock: new FakeClock(),
      ids: new SequentialIds(),
      handlers: ackExcept(handlers, kinds),
      isOnline: () => true,
      onRejected: () => {},
    });

  it('runs the real handler for the kinds something answers, and acknowledges the rest', async () => {
    const delivered: unknown[] = [];
    const outbox = outboxWith(
      {
        createPost: async (payload) => void delivered.push(payload),
        setKudos: async () => {
          throw new Error('no chain');
        },
      },
      ['createPost']
    );

    await outbox.enqueue({ kind: 'createPost', payload: { text: 'hi' } });
    await outbox.enqueue({ kind: 'setKudos', payload: {} });
    await outbox.drain();

    expect(delivered).toEqual([{ text: 'hi' }]);
    expect(outbox.entries()).toEqual([]);
  });

  it('keeps a served kind that fails, to try again, instead of pretending it went through', async () => {
    const outbox = outboxWith(
      {
        createPost: async () => {
          throw new Error('down');
        },
      },
      ['createPost']
    );

    await outbox.enqueue({ kind: 'createPost', payload: {} });
    await outbox.drain();

    expect(outbox.entries()).toHaveLength(1);
  });

  it('acknowledges a served kind the real handlers do not know', async () => {
    const outbox = outboxWith({}, ['createPost']);

    await outbox.enqueue({ kind: 'createPost', payload: {} });
    await outbox.drain();

    expect(outbox.entries()).toEqual([]);
  });
});
