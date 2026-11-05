/**
 * A verbose, per-recording trace of live tracking, for finding where the reported stats go wrong.
 * Each event is one JSON line ({ seq, t, kind, ...data }) appended to
 * `tracking-traces/<start>-<sport>.ndjson` in the app's documents.
 */

export const TRACE_FOLDER = 'tracking-traces';
/** Older traces are deleted when a new one starts. */
export const TRACE_KEEP = 20;
/** Buffered lines are written at least this often, so a killed app loses little. */
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_LINES = 200;

export type TraceData = Record<string, unknown>;

/** What the tracker and session call; a no-op unless a recording is being traced. */
export interface TraceRecorder {
  record(kind: string, data?: TraceData): void;
}

export interface TraceStore {
  append(path: string, content: string): void;
  list(folder: string): string[];
  remove(uri: string): void;
}

export interface TrackingTrace extends TraceRecorder {
  /** Opens a new trace file; anything still open is closed first. */
  begin(sport: string, data?: TraceData): void;
  /** Records the last event and closes the file. */
  end(kind: string, data?: TraceData): void;
  /** Writes what is buffered if it has waited long enough. */
  flushIfDue(): void;
  /** The open trace's path, or null. */
  currentPath(): string | null;
}

export interface TrackingTraceOptions {
  store: TraceStore;
  now: () => number;
  enabled: boolean;
  /** Told once when writing fails; tracing then stops for the rest of the recording. */
  onError?: (error: unknown) => void;
}

/** Rounds to a fixed number of decimals so a trace stays readable and small. */
export function round(value: number | null | undefined, decimals = 2): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function fileStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[:.]/g, '-');
}

export function createTrackingTrace({
  store,
  now,
  enabled,
  onError,
}: TrackingTraceOptions): TrackingTrace {
  let path: string | null = null;
  let pending: string[] = [];
  let seq = 0;
  let lastFlush = 0;
  let broken = false;

  function flush(): void {
    if (!path || pending.length === 0 || broken) return;
    const chunk = `${pending.join('\n')}\n`;
    pending = [];
    lastFlush = now();
    try {
      store.append(path, chunk);
    } catch (error) {
      broken = true;
      onError?.(error);
    }
  }

  function prune(): void {
    try {
      const existing = store.list(TRACE_FOLDER);
      for (const uri of existing.slice(0, Math.max(0, existing.length - (TRACE_KEEP - 1)))) {
        store.remove(uri);
      }
    } catch (error) {
      onError?.(error);
    }
  }

  function record(kind: string, data: TraceData = {}): void {
    if (!path || broken) return;
    pending.push(JSON.stringify({ seq: seq++, t: now(), kind, ...data }));
    if (pending.length >= FLUSH_LINES) flush();
  }

  function end(kind: string, data: TraceData = {}): void {
    if (!path) return;
    record(kind, data);
    flush();
    path = null;
  }

  return {
    record,

    begin(sport, data = {}) {
      if (!enabled) return;
      if (path) end('trace.superseded');
      broken = false;
      seq = 0;
      prune();
      const started = now();
      path = `${TRACE_FOLDER}/${fileStamp(started)}-${sport.replace(/[^a-z0-9-]/gi, '')}.ndjson`;
      lastFlush = started;
      record('trace.begin', { sport, ...data });
      flush();
    },

    end,

    flushIfDue() {
      if (path && now() - lastFlush >= FLUSH_INTERVAL_MS) flush();
    },

    currentPath: () => path,
  };
}

/** Records nothing; the default where no trace is wired in. */
export const NO_TRACE: TraceRecorder = { record() {} };
