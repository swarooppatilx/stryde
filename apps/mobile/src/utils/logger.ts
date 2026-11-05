import { isChainOfflineNoise } from './chainOfflineNoise';
import { createLogBuffer, type LogLevel } from './logBuffer';

export type { LogLevel } from './logBuffer';

type Sink = (level: 'warn' | 'error', args: unknown[]) => void;

const BUFFER_CAPACITY = 500;
const SEVERITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Every log line since launch, newest last, for the developer tools. */
export const logBuffer = createLogBuffer({ capacity: BUFFER_CAPACITY, now: () => Date.now() });

let sink: Sink | null = null;
let consoleLevel: LogLevel = 'warn';

/** Where warnings and errors go besides the console, e.g. a crash reporter. */
export function setLogSink(next: Sink | null): void {
  sink = next;
}

/** The least severe level that also prints to the console; everything is kept in `logBuffer` either way. */
export function setConsoleLevel(level: LogLevel): void {
  consoleLevel = level;
}

function forward(level: 'warn' | 'error', args: unknown[]) {
  try {
    sink?.(level, args);
  } catch {
    // Reporting must never take the app down with it.
  }
}

function record(level: LogLevel, args: unknown[]) {
  logBuffer.add(level, args);
  // biome-ignore lint/suspicious/noConsole: the logger is the single sanctioned console writer
  if (SEVERITY[level] >= SEVERITY[consoleLevel]) console[level](...args);
}

export const logger = {
  debug(...args: unknown[]) {
    record('debug', args);
  },
  info(...args: unknown[]) {
    record('info', args);
  },
  warn(...args: unknown[]) {
    // The Sandbox's switched-off chain fails every read on purpose: that is not a warning to act on.
    if (isChainOfflineNoise(args)) {
      record('debug', args);
      return;
    }
    record('warn', args);
    forward('warn', args);
  },
  error(...args: unknown[]) {
    record('error', args);
    forward('error', args);
  },
};
