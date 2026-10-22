import { describe, expect, it } from 'vitest';
import {
  actionCue,
  audioCueIntervalLabel,
  dueCue,
  halfCue,
  lapCue,
  splitCue,
} from '@/utils/audioCue';
import { METERS_PER_MILE } from '@/utils/format';

const split = (index: number, movingTime: number) => ({ index, distance: 1000, movingTime });

describe('splitCue', () => {
  it('says the distance and the pace in words a voice can read', () => {
    expect(splitCue(split(1, 312_000), 'run', 'metric')).toBe(
      '1 kilometre. Pace 5 minutes 12 seconds per kilometre.'
    );
  });

  it('pluralises and drops a zero-seconds clause', () => {
    expect(splitCue(split(5, 300_000), 'run', 'metric')).toBe(
      '5 kilometres. Pace 5 minutes per kilometre.'
    );
  });

  it('uses miles for imperial', () => {
    const mile = { index: 2, distance: 1609.34, movingTime: 600_000 };
    expect(splitCue(mile, 'run', 'imperial')).toBe('2 miles. Pace 10 minutes per mile.');
  });

  it('reads a ride as speed', () => {
    expect(splitCue(split(10, 120_000), 'ride', 'metric')).toBe(
      '10 kilometres. Speed 30 kilometres per hour.'
    );
  });

  it('adds the total time so far when it is known, between the distance and the pace', () => {
    expect(splitCue(split(5, 300_000), 'run', 'metric', 1_548_000)).toBe(
      '5 kilometres. Time 25 minutes 48 seconds. Pace 5 minutes per kilometre.'
    );
  });

  it('says hours in the total once a run passes an hour', () => {
    expect(splitCue(split(12, 300_000), 'run', 'metric', 3_725_000)).toBe(
      '12 kilometres. Time 1 hour 2 minutes 5 seconds. Pace 5 minutes per kilometre.'
    );
  });

  it('gives a ride its total time too', () => {
    expect(splitCue(split(10, 120_000), 'ride', 'metric', 1_200_000)).toBe(
      '10 kilometres. Time 20 minutes. Speed 30 kilometres per hour.'
    );
  });

  it('says nothing for a split with no moving time', () => {
    expect(splitCue(split(1, 0), 'run', 'metric')).toBeNull();
  });
});

describe('actionCue', () => {
  it('names the action and the sport', () => {
    expect(actionCue('start', 'run')).toBe('Starting run.');
    expect(actionCue('pause', 'ride')).toBe('Pausing ride.');
    expect(actionCue('resume', 'hike')).toBe('Resuming hike.');
    expect(actionCue('finish', 'walk')).toBe('Stopping walk.');
  });
});

describe('lapCue', () => {
  it('says the lap number, its time and its distance in words', () => {
    expect(lapCue({ index: 3, distance: 1000, duration: 312_000 }, 'metric')).toBe(
      'Lap 3. 5 minutes 12 seconds. 1 kilometre.'
    );
  });

  it('uses miles for imperial and drops a zero-seconds clause', () => {
    expect(lapCue({ index: 1, distance: 1609.34, duration: 600_000 }, 'imperial')).toBe(
      'Lap 1. 10 minutes. 1 mile.'
    );
  });

  it('rounds a fractional distance to something a voice can say', () => {
    expect(lapCue({ index: 2, distance: 400, duration: 95_000 }, 'metric')).toBe(
      'Lap 2. 1 minute 35 seconds. 400 metres.'
    );
  });
});

describe('dueCue', () => {
  it('is due at every half kilometre when the athlete picks halves', () => {
    expect(dueCue(0, 499, 1000, 'half')).toBeNull();
    expect(dueCue(0, 500, 1000, 'half')).toEqual({ halves: 1, whole: false });
    expect(dueCue(1, 1000, 1000, 'half')).toEqual({ halves: 2, whole: true });
    expect(dueCue(2, 1500, 1000, 'half')).toEqual({ halves: 3, whole: false });
  });

  it('skips the halves when the athlete picks whole kilometres', () => {
    expect(dueCue(0, 500, 1000, 'unit')).toBeNull();
    expect(dueCue(0, 1000, 1000, 'unit')).toEqual({ halves: 2, whole: true });
    expect(dueCue(2, 1600, 1000, 'unit')).toBeNull();
    expect(dueCue(2, 2000, 1000, 'unit')).toEqual({ halves: 4, whole: true });
  });

  it('measures halves in miles for an imperial athlete', () => {
    expect(dueCue(0, 800, METERS_PER_MILE, 'half')).toBeNull();
    expect(dueCue(0, 810, METERS_PER_MILE, 'half')).toEqual({ halves: 1, whole: false });
    expect(dueCue(1, METERS_PER_MILE, METERS_PER_MILE, 'half')).toEqual({ halves: 2, whole: true });
    expect(dueCue(0, 1000, METERS_PER_MILE, 'unit')).toBeNull();
  });

  it('gives only the furthest point when one update passes several', () => {
    // From 1 km straight past 1.5 and 2 to 2.6 km: only 2.5 is worth saying.
    expect(dueCue(2, 2600, 1000, 'half')).toEqual({ halves: 5, whole: false });
    expect(dueCue(3, 2100, 1000, 'half')).toEqual({ halves: 4, whole: true });
    expect(dueCue(0, 3200, 1000, 'unit')).toEqual({ halves: 6, whole: true });
  });

  it('does not repeat a point already said across a pause and resume', () => {
    // 1.5 km was said; standing still, or the distance slipping back a little, says nothing new.
    expect(dueCue(3, 1520, 1000, 'half')).toBeNull();
    expect(dueCue(3, 1490, 1000, 'half')).toBeNull();
    expect(dueCue(3, 1500, 1000, 'half')).toBeNull();
    expect(dueCue(3, 2000, 1000, 'half')).toEqual({ halves: 4, whole: true });
  });

  it('is never due with cues off', () => {
    expect(dueCue(0, 500, 1000, 'off')).toBeNull();
    expect(dueCue(0, 5000, 1000, 'off')).toBeNull();
  });
});

describe('halfCue', () => {
  it('says the distance with its half and the time so far', () => {
    expect(halfCue(5, 'metric', 750_000)).toBe(
      'Distance 2.5 kilometres. Time 12 minutes 30 seconds.'
    );
  });

  it('uses miles for imperial, even for the first half', () => {
    expect(halfCue(1, 'imperial', 240_000)).toBe('Distance 0.5 miles. Time 4 minutes.');
  });

  it('says just the distance when the time is not known', () => {
    expect(halfCue(3, 'metric')).toBe('Distance 1.5 kilometres.');
  });
});

describe('audioCueIntervalLabel', () => {
  it('names each choice in the athlete’s units', () => {
    expect(audioCueIntervalLabel('off', 'metric')).toBe('Off');
    expect(audioCueIntervalLabel('unit', 'metric')).toBe('Every km');
    expect(audioCueIntervalLabel('half', 'metric')).toBe('Every half km');
    expect(audioCueIntervalLabel('unit', 'imperial')).toBe('Every mi');
    expect(audioCueIntervalLabel('half', 'imperial')).toBe('Every half mi');
  });
});
