import { describe, expect, it } from 'vitest';
import {
  hasStreetData,
  isDarkBase,
  MAPBOX_SATELLITE_URL,
  MAPBOX_STYLE_URL,
  mapboxStyleUrl,
  staticPreviewUrl,
} from '@/constants/mapboxStyle';

describe('mapboxStyleUrl', () => {
  it('follows light and dark for the standard map', () => {
    expect(mapboxStyleUrl(false)).toBe(MAPBOX_STYLE_URL.light);
    expect(mapboxStyleUrl(true, 'standard')).toBe(MAPBOX_STYLE_URL.dark);
  });

  it('uses imagery for satellite and hybrid whatever the appearance', () => {
    expect(mapboxStyleUrl(false, 'satellite')).toBe(MAPBOX_SATELLITE_URL.satellite);
    expect(mapboxStyleUrl(true, 'hybrid')).toBe(MAPBOX_SATELLITE_URL.hybrid);
  });
});

describe('base map traits', () => {
  it('has street data everywhere but bare imagery', () => {
    expect(hasStreetData('standard')).toBe(true);
    expect(hasStreetData('hybrid')).toBe(true);
    expect(hasStreetData('satellite')).toBe(false);
  });

  it('treats imagery as a dark base', () => {
    expect(isDarkBase(false, 'standard')).toBe(false);
    expect(isDarkBase(false, 'satellite')).toBe(true);
    expect(isDarkBase(true, 'standard')).toBe(true);
  });
});

describe('staticPreviewUrl', () => {
  it('builds a Static Images request for the style and centre', () => {
    const url = staticPreviewUrl(MAPBOX_STYLE_URL.light, [73.85671, 18.52043], 'pk.test');
    expect(url).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/73.8567,18.5204,13,0/176x128@2x?attribution=false&logo=false&access_token=pk.test'
    );
  });
});
