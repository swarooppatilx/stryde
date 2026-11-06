import { describe, expect, it } from 'vitest';
import { flyoutRows, islandStatIds } from '@/utils/recordIsland';

describe('islandStatIds', () => {
  const always = () => true;

  it('shows the first three figures of the live layout', () => {
    expect(
      islandStatIds(['time', 'distance', 'pace', 'elevation', 'speed', 'laps'], always)
    ).toEqual(['time', 'distance', 'pace']);
  });

  it('skips a figure with no data behind it and takes the next one', () => {
    expect(islandStatIds(['time', 'altitude', 'pace', 'speed'], (id) => id !== 'altitude')).toEqual(
      ['time', 'pace', 'speed']
    );
  });

  it('never shows more than three, and copes with a short layout', () => {
    expect(islandStatIds(['time'], always)).toEqual(['time']);
  });
});

describe('flyoutRows', () => {
  it('shows each option with its current value', () => {
    const rows = flyoutRows({ trackLaps: true, mapStyle: 'auto', liveShare: false });
    expect(rows.map((r) => r.id)).toEqual(['laps', 'settings', 'layers', 'share', 'sensor']);
    expect(rows.find((r) => r.id === 'laps')?.subtitle).toBe('On');
    expect(rows.find((r) => r.id === 'settings')?.subtitle).toBe('Audio cues, auto-pause');
  });

  it('names the map style in use', () => {
    const rows = flyoutRows({ trackLaps: true, mapStyle: 'dark', liveShare: false });
    expect(rows.find((r) => r.id === 'layers')?.subtitle).toBe('Dark');
  });

  it('says Off when laps are not tracked', () => {
    expect(flyoutRows({ trackLaps: false, mapStyle: 'auto', liveShare: false })[0]?.subtitle).toBe(
      'Off'
    );
  });

  it('lists options that are not built yet as plain coming-later rows', () => {
    const later = flyoutRows({ trackLaps: true, mapStyle: 'auto', liveShare: false }).filter(
      (r) => !r.available
    );
    expect(later.map((r) => [r.id, r.subtitle])).toEqual([['sensor', 'Coming later']]);
  });

  it('shows live location as a switch with its current value', () => {
    const on = flyoutRows({ trackLaps: true, mapStyle: 'auto', liveShare: true });
    expect(on.find((r) => r.id === 'share')).toMatchObject({ subtitle: 'On', available: true });
    const off = flyoutRows({ trackLaps: true, mapStyle: 'auto', liveShare: false });
    expect(off.find((r) => r.id === 'share')).toMatchObject({ subtitle: 'Off', available: true });
  });

  it('leaves live location out when it cannot work', () => {
    const rows = flyoutRows({ trackLaps: true, mapStyle: 'auto', liveShare: null });
    expect(rows.map((r) => r.id)).toEqual(['laps', 'settings', 'layers', 'sensor']);
  });
});
