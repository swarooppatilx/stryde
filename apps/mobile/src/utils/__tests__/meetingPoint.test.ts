import { describe, expect, it } from 'vitest';
import {
  directionsUrl,
  formatMeetingPoint,
  meetingPointFromChain,
  meetingPointToChain,
  usefulPlaceName,
} from '../meetingPoint';

describe('meetingPoint', () => {
  it('treats 0/0 as no place', () => {
    expect(meetingPointFromChain(0, 0)).toBeUndefined();
    expect(meetingPointToChain(undefined)).toEqual({ startLat: 0, startLng: 0 });
  });

  it('round-trips through the chain encoding', () => {
    const chain = meetingPointToChain({ latitude: 18.520431, longitude: 73.856743 });
    expect(chain).toEqual({ startLat: 18520431, startLng: 73856743 });
    expect(meetingPointFromChain(chain.startLat, chain.startLng)).toEqual({
      latitude: 18.520431,
      longitude: 73.856743,
    });
  });

  it('keeps southern and western points negative', () => {
    expect(meetingPointToChain({ latitude: -33.8688, longitude: -70.6693 })).toEqual({
      startLat: -33868800,
      startLng: -70669300,
    });
  });

  it('builds a directions link and a short label', () => {
    const p = { latitude: 18.5204, longitude: 73.8567 };
    expect(directionsUrl(p)).toContain('destination=18.520400,73.856700');
    expect(formatMeetingPoint(p)).toBe('18.52040, 73.85670');
  });

  it('drops place names that are only coordinates', () => {
    expect(usefulPlaceName('18.5292,73.8237')).toBeNull();
    expect(usefulPlaceName('18.5292, 73.8237, Pune')).toBeNull();
    expect(usefulPlaceName('  ')).toBeNull();
    expect(usefulPlaceName('Vetal Tekdi, Pune')).toBe('Vetal Tekdi, Pune');
  });
});
