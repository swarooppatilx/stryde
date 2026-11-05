import { describe, expect, it } from 'vitest';
import {
  createTrackingTrace,
  round,
  TRACE_FOLDER,
  TRACE_KEEP,
  type TraceStore,
} from '@/utils/trackingTrace';

function memoryStore(seed: string[] = []) {
  const files = new Map<string, string>(seed.map((uri) => [uri, '']));
  const store: TraceStore = {
    append(path, content) {
      const uri = `mem://${path}`;
      files.set(uri, (files.get(uri) ?? '') + content);
    },
    list(folder) {
      return [...files.keys()].filter((uri) => uri.startsWith(`mem://${folder}/`)).sort();
    },
    remove(uri) {
      files.delete(uri);
    },
  };
  const lines = (uri: string) =>
    (files.get(uri) ?? '')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { store, files, lines };
}

describe('createTrackingTrace', () => {
  it('writes each event as a JSON line in the order recorded', () => {
    let t = 1_700_000_000_000;
    const { store, files, lines } = memoryStore();
    const trace = createTrackingTrace({ store, now: () => t, enabled: true });

    trace.begin('run', { autoPause: true });
    t += 1000;
    trace.record('fix', { lat: 18.5 });
    trace.end('session.finish', { distance: 1200 });

    const [uri] = [...files.keys()];
    expect(uri).toMatch(new RegExp(`^mem://${TRACE_FOLDER}/.*-run\\.ndjson$`));
    expect(lines(uri as string)).toEqual([
      { seq: 0, t: 1_700_000_000_000, kind: 'trace.begin', sport: 'run', autoPause: true },
      { seq: 1, t: 1_700_000_001_000, kind: 'fix', lat: 18.5 },
      { seq: 2, t: 1_700_000_001_000, kind: 'session.finish', distance: 1200 },
    ]);
    expect(trace.currentPath()).toBeNull();
  });

  it('buffers until a flush is due', () => {
    let t = 0;
    const { store, files, lines } = memoryStore();
    const trace = createTrackingTrace({ store, now: () => t, enabled: true });
    trace.begin('ride');
    const uri = `mem://${trace.currentPath()}`;

    trace.record('stats');
    trace.flushIfDue();
    expect(lines(uri)).toHaveLength(1);

    t += 5_000;
    trace.flushIfDue();
    expect(lines(uri)).toHaveLength(2);
    expect(files.size).toBe(1);
  });

  it('records nothing when disabled', () => {
    const { store, files } = memoryStore();
    const trace = createTrackingTrace({ store, now: () => 0, enabled: false });
    trace.begin('run');
    trace.record('fix');
    trace.end('session.finish');
    expect(files.size).toBe(0);
  });

  it('keeps only the newest traces', () => {
    const old = Array.from(
      { length: TRACE_KEEP + 3 },
      (_, i) => `mem://${TRACE_FOLDER}/old-${String(i).padStart(2, '0')}`
    );
    const { store, files } = memoryStore(old);
    const trace = createTrackingTrace({ store, now: () => 0, enabled: true });
    trace.begin('run');
    expect(store.list(TRACE_FOLDER)).toHaveLength(TRACE_KEEP);
    expect(files.has(old[0] as string)).toBe(false);
  });

  it('stops quietly after a failed write', () => {
    const errors: unknown[] = [];
    const store: TraceStore = {
      append() {
        throw new Error('disk full');
      },
      list: () => [],
      remove() {},
    };
    const trace = createTrackingTrace({
      store,
      now: () => 0,
      enabled: true,
      onError: (e) => errors.push(e),
    });
    trace.begin('run');
    trace.record('fix');
    trace.end('session.finish');
    expect(errors).toHaveLength(1);
  });
});

describe('round', () => {
  it('rounds finite numbers and nulls the rest', () => {
    expect(round(1.23456, 3)).toBe(1.235);
    expect(round(Number.NaN)).toBeNull();
    expect(round(undefined)).toBeNull();
  });
});
