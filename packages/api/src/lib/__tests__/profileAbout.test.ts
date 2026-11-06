import { describe, expect, it, vi } from 'vitest';
import {
  AboutError,
  type AboutRecord,
  type AboutStore,
  createAboutService,
  MAX_BIO_LENGTH,
  MAX_LOCATION_LENGTH,
} from '../profileAbout.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const NOW = 1_000_000;
const SIGNATURE = '0xsigned' as const;

function memoryStore(): AboutStore & { records: AboutRecord[]; log: string[] } {
  const records: AboutRecord[] = [];
  const log: string[] = [];
  return {
    records,
    log,
    async find(author) {
      return records.find((r) => r.author === author) ?? null;
    },
    async create(input) {
      log.push('create');
      const record = { entityKey: `key-${log.length}`, ...input };
      records.push(record);
      return record;
    },
    async remove(entityKey) {
      log.push('remove');
      const index = records.findIndex((r) => r.entityKey === entityKey);
      if (index >= 0) records.splice(index, 1);
    },
    async removeAllFor(author) {
      const gone = records.filter((r) => r.author === author);
      for (const record of gone) records.splice(records.indexOf(record), 1);
      return gone.length;
    },
    async many(authors) {
      return records.filter((r) => authors.includes(r.author));
    },
  };
}

const intent = (over: Record<string, unknown> = {}) => ({
  author: ME,
  bio: 'Trail runner. Coffee first.',
  location: 'Pune, India',
  deadline: NOW + 60,
  ...over,
});

function setup(verify = vi.fn(async () => true)) {
  const store = memoryStore();
  const service = createAboutService({ store, verify, now: () => NOW });
  return { store, service, verify };
}

describe('about service', () => {
  it('saves what the author signed and reads it back', async () => {
    const { service, store } = setup();

    await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(store.records).toHaveLength(1);
    expect(await service.forAuthors([ME])).toEqual({
      about: { [ME]: { bio: 'Trail runner. Coffee first.', location: 'Pune, India' } },
    });
  });

  it('refuses text the author did not sign', async () => {
    const { service, store } = setup(vi.fn(async () => false));

    await expect(service.apply({ intent: intent(), signature: SIGNATURE })).rejects.toMatchObject({
      code: 'bad_signature',
    });
    expect(store.records).toEqual([]);
  });

  it('refuses a request that has expired or is dated too far ahead', async () => {
    const { service } = setup();

    await expect(
      service.apply({ intent: intent({ deadline: NOW - 1 }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'expired' });
    await expect(
      service.apply({ intent: intent({ deadline: NOW + 100_000 }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'expired' });
  });

  it('writes the new version before removing the old one, so a failure never loses the bio', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });
    store.log.length = 0;

    await service.apply({ intent: intent({ bio: 'New bio' }), signature: SIGNATURE });

    expect(store.log).toEqual(['create', 'remove']);
    expect(store.records).toHaveLength(1);
    expect(store.records[0]?.bio).toBe('New bio');
  });

  it('clears the record when both fields are emptied', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    await service.apply({ intent: intent({ bio: '  ', location: '' }), signature: SIGNATURE });

    expect(store.records).toEqual([]);
    expect(await service.forAuthors([ME])).toEqual({ about: {} });
  });

  it('keeps one author from writing another author’s record', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent({ author: THEM, bio: 'theirs' }), signature: SIGNATURE });

    await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(store.records.map((r) => r.author).sort()).toEqual([ME, THEM]);
  });

  it('trims the text and rejects text that is too long or has control characters', async () => {
    const { service, store } = setup();

    await service.apply({
      intent: intent({ bio: '  hi  ', location: ' Pune ' }),
      signature: SIGNATURE,
    });
    expect(store.records[0]).toMatchObject({ bio: 'hi', location: 'Pune' });

    for (const bad of [
      intent({ bio: 'x'.repeat(MAX_BIO_LENGTH + 1) }),
      intent({ location: 'x'.repeat(MAX_LOCATION_LENGTH + 1) }),
      intent({ bio: 'bell\u0007' }),
      intent({ location: 'two\nlines' }),
      intent({ bio: 42 }),
    ]) {
      await expect(service.apply({ intent: bad, signature: SIGNATURE })).rejects.toBeInstanceOf(
        AboutError
      );
    }
  });

  it('only reads a bounded list of valid addresses', async () => {
    const { service } = setup();

    await expect(service.forAuthors('nope')).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.forAuthors(['not-an-address'])).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.forAuthors(Array.from({ length: 101 }, () => ME))).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('shows the newest version when a failed cleanup left two records for one author', async () => {
    const { service, store } = setup();
    store.records.push(
      { entityKey: 'old', author: ME, bio: 'old bio', location: '', updatedAt: NOW - 500 },
      { entityKey: 'new', author: ME, bio: 'new bio', location: '', updatedAt: NOW - 5 }
    );

    expect(await service.forAuthors([ME])).toEqual({
      about: { [ME]: { bio: 'new bio', location: '' } },
    });
  });
});
