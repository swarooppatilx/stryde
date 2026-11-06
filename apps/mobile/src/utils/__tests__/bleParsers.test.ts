import { describe, expect, it } from 'vitest';
import {
  advanceRevolutions,
  decodeBase64,
  parseCscMeasurement,
  parseCyclingPower,
  parseHeartRate,
  type RevolutionState,
} from '@/utils/bleParsers';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('decodeBase64', () => {
  it('decodes padded and unpadded characteristic values', () => {
    expect([...decodeBase64('AEg=')]).toEqual([0x00, 0x48]);
    expect([...decodeBase64('AUgA')]).toEqual([0x01, 0x48, 0x00]);
    expect([...decodeBase64('AA==')]).toEqual([0x00]);
    expect([...decodeBase64('')]).toEqual([]);
  });

  it('ignores characters outside the alphabet instead of throwing', () => {
    expect([...decodeBase64('AE g=\n')]).toEqual([0x00, 0x48]);
  });
});

describe('parseHeartRate', () => {
  it('reads an 8-bit value (flags 0x00)', () => {
    expect(parseHeartRate(bytes(0x00, 0x48))).toEqual({ bpm: 72, contact: 'unsupported', rr: [] });
  });

  it('reads a 16-bit value (flags 0x01)', () => {
    expect(parseHeartRate(bytes(0x01, 0x90, 0x00))?.bpm).toBe(144);
    expect(parseHeartRate(bytes(0x01, 0x2c, 0x01))?.bpm).toBe(300);
  });

  it('reads the sensor contact bits', () => {
    expect(parseHeartRate(bytes(0x06, 0x50))?.contact).toBe('detected');
    expect(parseHeartRate(bytes(0x04, 0x50))?.contact).toBe('lost');
    expect(parseHeartRate(bytes(0x02, 0x50))?.contact).toBe('unsupported');
  });

  it('skips energy expended and converts RR intervals from 1/1024 s to milliseconds', () => {
    const value = bytes(0x18, 0x50, 0x10, 0x00, 0x00, 0x04, 0x00, 0x02);
    expect(parseHeartRate(value)).toEqual({ bpm: 80, contact: 'unsupported', rr: [1000, 500] });
  });

  it('returns null for a truncated value', () => {
    expect(parseHeartRate(bytes())).toBeNull();
    expect(parseHeartRate(bytes(0x00))).toBeNull();
    expect(parseHeartRate(bytes(0x01, 0x90))).toBeNull();
  });
});

describe('parseCyclingPower', () => {
  it('reads instantaneous power with flags 0x0000', () => {
    expect(parseCyclingPower(bytes(0x00, 0x00, 0x00, 0x00))).toEqual({ power: 0 });
    expect(parseCyclingPower(bytes(0x00, 0x00, 0xfa, 0x00))).toEqual({ power: 250 });
  });

  it('reads power as a signed value', () => {
    expect(parseCyclingPower(bytes(0x00, 0x00, 0xfe, 0xff))?.power).toBe(-2);
  });

  it('reads pedal power balance in half percent steps', () => {
    expect(parseCyclingPower(bytes(0x01, 0x00, 0x64, 0x00, 0x64))).toEqual({
      power: 100,
      balance: 50,
    });
  });

  it('finds crank revolution data after the optional fields before it', () => {
    const crankOnly = bytes(0x20, 0x00, 0x96, 0x00, 0x0a, 0x00, 0x00, 0x04);
    expect(parseCyclingPower(crankOnly)).toEqual({ power: 150, crank: { revs: 10, time: 1024 } });
    const everything = bytes(
      ...[0x35, 0x00, 0x96, 0x00],
      0x64,
      ...[0x01, 0x02],
      ...[0x01, 0x00, 0x00, 0x00, 0x05, 0x00],
      ...[0x0b, 0x00, 0x00, 0x08]
    );
    expect(parseCyclingPower(everything)).toEqual({
      power: 150,
      balance: 50,
      crank: { revs: 11, time: 2048 },
    });
  });

  it('returns null when flagged data is cut short', () => {
    expect(parseCyclingPower(bytes(0x00, 0x00, 0x01))).toBeNull();
    expect(parseCyclingPower(bytes(0x20, 0x00, 0x96, 0x00, 0x0a))).toBeNull();
  });
});

describe('parseCscMeasurement', () => {
  it('reads wheel data (flags 0x01)', () => {
    const value = bytes(0x01, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x04);
    expect(parseCscMeasurement(value)).toEqual({ wheel: { revs: 10, time: 1024 } });
  });

  it('reads crank data (flags 0x02)', () => {
    const value = bytes(0x02, 0x05, 0x00, 0x00, 0x08);
    expect(parseCscMeasurement(value)).toEqual({ crank: { revs: 5, time: 2048 } });
  });

  it('reads both (flags 0x03)', () => {
    const value = bytes(0x03, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x04, 0x05, 0x00, 0x00, 0x08);
    expect(parseCscMeasurement(value)).toEqual({
      wheel: { revs: 10, time: 1024 },
      crank: { revs: 5, time: 2048 },
    });
  });

  it('returns an empty reading for flags 0x00 and null when truncated', () => {
    expect(parseCscMeasurement(bytes(0x00))).toEqual({});
    expect(parseCscMeasurement(bytes(0x03, 0x0a, 0x00))).toBeNull();
    expect(parseCscMeasurement(bytes())).toBeNull();
  });
});

describe('advanceRevolutions', () => {
  const crank = { revBits: 16, timeHz: 1024 } as const;

  it('has no rate on the first reading', () => {
    const { rate, state } = advanceRevolutions(null, { revs: 10, time: 0 }, 1000, crank);
    expect(rate).toBeNull();
    expect(state.revs).toBe(10);
  });

  it('works out revolutions per second from the change', () => {
    const first = advanceRevolutions(null, { revs: 10, time: 0 }, 1000, crank);
    const second = advanceRevolutions(first.state, { revs: 11, time: 1024 }, 2000, crank);
    expect(second.rate).toBe(1);
  });

  it('survives the 16-bit counter and time rolling over', () => {
    const before: RevolutionState = { revs: 65535, time: 65024, changedAt: 0, rate: null };
    const { rate } = advanceRevolutions(before, { revs: 1, time: 512 }, 1000, crank);
    expect(rate).toBeCloseTo(2, 5);
  });

  it('survives a 32-bit wheel counter rolling over', () => {
    const before: RevolutionState = { revs: 0xffffffff, time: 0, changedAt: 0, rate: null };
    const { rate } = advanceRevolutions(before, { revs: 1, time: 1024 }, 1000, {
      revBits: 32,
      timeHz: 1024,
    });
    expect(rate).toBe(2);
  });

  it('holds the last rate while a repeated event is still recent, then reports a stop', () => {
    const first = advanceRevolutions(null, { revs: 10, time: 0 }, 1000, crank);
    const moving = advanceRevolutions(first.state, { revs: 11, time: 1024 }, 2000, crank);
    const repeated = advanceRevolutions(moving.state, { revs: 11, time: 1024 }, 3500, crank);
    expect(repeated.rate).toBe(1);
    const stale = advanceRevolutions(repeated.state, { revs: 11, time: 1024 }, 5000, crank);
    expect(stale.rate).toBe(0);
  });

  it('ignores an event time that went backwards without revolutions', () => {
    const first = advanceRevolutions(null, { revs: 10, time: 5000 }, 1000, crank);
    const odd = advanceRevolutions(first.state, { revs: 10, time: 4000 }, 1500, crank);
    expect(odd.rate).toBeNull();
  });

  it('drops an impossible jump instead of showing it', () => {
    const first = advanceRevolutions(null, { revs: 10, time: 0 }, 1000, crank);
    const jump = advanceRevolutions(first.state, { revs: 300, time: 1024 }, 2000, crank);
    expect(jump.rate).toBeNull();
  });
});
