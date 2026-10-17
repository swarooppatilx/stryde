import { describe, expect, it, vi } from 'vitest';
import { createLogBuffer, formatLogArgs, parseNamespace } from '@/utils/logBuffer';

describe('parseNamespace', () => {
  it('reads the [Tag] prefix the codebase already uses', () => {
    expect(parseNamespace(['[PostRun] Photo upload failed', new Error('x')])).toBe('PostRun');
  });

  it('is undefined without a prefix or a leading string', () => {
    expect(parseNamespace(['plain message'])).toBeUndefined();
    expect(parseNamespace([42])).toBeUndefined();
    expect(parseNamespace([])).toBeUndefined();
  });
});

describe('formatLogArgs', () => {
  it('joins strings and shows errors by name and message', () => {
    expect(formatLogArgs(['[A] failed', new TypeError('bad input')])).toBe(
      '[A] failed TypeError: bad input'
    );
  });

  it('serialises objects, and survives ones that cannot be', () => {
    expect(formatLogArgs([{ a: 1 }])).toBe('{"a":1}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatLogArgs([circular])).toBe('[object Object]');
  });

  it('shortens very long output', () => {
    expect(formatLogArgs(['x'.repeat(5000)]).length).toBeLessThanOrEqual(2001);
  });
});

describe('createLogBuffer', () => {
  it('keeps entries in order with level, namespace and a message', () => {
    const buffer = createLogBuffer({ capacity: 10, now: () => 1000 });
    buffer.add('warn', ['[Sync] slow']);
    expect(buffer.entries()).toEqual([
      { id: 1, time: 1000, level: 'warn', namespace: 'Sync', message: '[Sync] slow' },
    ]);
  });

  it('drops the oldest entries past its capacity', () => {
    const buffer = createLogBuffer({ capacity: 3, now: () => 0 });
    for (const n of [1, 2, 3, 4]) buffer.add('info', [`m${n}`]);
    expect(buffer.entries().map((e) => e.message)).toEqual(['m2', 'm3', 'm4']);
  });

  it('tells subscribers about each new entry until they unsubscribe', () => {
    const buffer = createLogBuffer({ capacity: 3, now: () => 0 });
    const listener = vi.fn();
    const off = buffer.subscribe(listener);
    buffer.add('info', ['a']);
    off();
    buffer.add('info', ['b']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears, and keeps ids increasing', () => {
    const buffer = createLogBuffer({ capacity: 3, now: () => 0 });
    buffer.add('info', ['a']);
    buffer.clear();
    buffer.add('info', ['b']);
    expect(buffer.entries().map((e) => e.id)).toEqual([2]);
  });

  it('returns a new array when entries change, so a hook can tell', () => {
    const buffer = createLogBuffer({ capacity: 3, now: () => 0 });
    const before = buffer.entries();
    buffer.add('info', ['a']);
    expect(buffer.entries()).not.toBe(before);
    expect(buffer.entries()).toBe(buffer.entries());
  });
});
