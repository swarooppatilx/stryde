export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  time: number;
  level: LogLevel;
  /** From a leading `[Tag]` in the message, the convention the codebase already uses. */
  namespace?: string;
  message: string;
}

export interface LogBuffer {
  add(level: LogLevel, args: unknown[]): void;
  /** Oldest first. The same array until something changes, so it works as a store snapshot. */
  entries(): readonly LogEntry[];
  subscribe(listener: () => void): () => void;
  clear(): void;
}

const MAX_MESSAGE_LENGTH = 2000;
const NAMESPACE = /^\[([^\]\s]+)\]/;

export function parseNamespace(args: readonly unknown[]): string | undefined {
  const first = args[0];
  return typeof first === 'string' ? NAMESPACE.exec(first)?.[1] : undefined;
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

export function formatLogArgs(args: readonly unknown[]): string {
  const text = args.map(formatArg).join(' ');
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

/** The last `capacity` log lines, kept in memory so a developer screen can show them. */
export function createLogBuffer({ capacity, now }: { capacity: number; now(): number }): LogBuffer {
  let items: LogEntry[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  return {
    add(level, args) {
      const entry: LogEntry = {
        id: nextId++,
        time: now(),
        level,
        namespace: parseNamespace(args),
        message: formatLogArgs(args),
      };
      if (entry.namespace === undefined) delete entry.namespace;
      items = [...items, entry].slice(-capacity);
      notify();
    },
    entries: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      items = [];
      notify();
    },
  };
}
