import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAIN_OFFLINE_MESSAGE } from '@/utils/chainOfflineNoise';
import { logBuffer, logger, setConsoleLevel, setLogSink } from '@/utils/logger';

afterEach(() => {
  setLogSink(null);
  setConsoleLevel('warn');
  logBuffer.clear();
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('writes to the console and forwards warnings and errors to the sink', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn();
    setLogSink(sink);
    const failure = new Error('rpc down');

    logger.warn('[Sync] Failed', failure);
    logger.error('[Wallet] Init failed');

    expect(warn).toHaveBeenCalledWith('[Sync] Failed', failure);
    expect(sink).toHaveBeenNthCalledWith(1, 'warn', ['[Sync] Failed', failure]);
    expect(sink).toHaveBeenNthCalledWith(2, 'error', ['[Wallet] Init failed']);
  });

  it('never lets a broken sink break the caller', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setLogSink(() => {
      throw new Error('sink down');
    });

    expect(() => logger.error('boom')).not.toThrow();
  });

  it('keeps every level in the buffer but prints only what the console level allows', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.debug('[Dev] d');
    logger.info('[Dev] i');
    logger.warn('[Dev] w');

    expect(logBuffer.entries().map((e) => e.level)).toEqual(['debug', 'info', 'warn']);
    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();

    setConsoleLevel('debug');
    logger.debug('[Dev] d2');
    expect(debug).toHaveBeenCalledWith('[Dev] d2');
  });

  it('sends only warnings and errors to the sink', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sink = vi.fn();
    setLogSink(sink);

    logger.info('[Dev] quiet');
    logger.warn('[Dev] loud');

    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('treats a failure caused by a switched-off chain (Sandbox) as debug noise: kept, not printed as a warning, not reported', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sink = vi.fn();
    setLogSink(sink);
    const offline = new Error(
      `An unknown RPC error occurred.\n\nDetails: ${CHAIN_OFFLINE_MESSAGE}`
    );

    logger.warn('[Social] Failed to fetch users:', offline);

    expect(warn).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
    expect(logBuffer.entries().at(-1)?.level).toBe('debug');
  });

  it('still warns about every other failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('[Social] Failed to fetch users:', new Error('connection refused'));

    expect(warn).toHaveBeenCalledOnce();
  });
});
