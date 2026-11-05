import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { buildOutdoorStyle, outdoorStyleFor, widen } from '@/constants/outdoorMapStyle';

describe.each(['dark', 'light'] as const)('outdoor map style (%s)', (mode) => {
  const style = buildOutdoorStyle(mode);

  it('passes the style specification validator', () => {
    expect(validateStyleMin(style as never)).toEqual([]);
  });

  it('has unique layer ids', () => {
    const ids = style.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only draws from sources it declares', () => {
    for (const layer of style.layers) {
      if ('source' in layer) expect(Object.keys(style.sources)).toContain(layer.source);
    }
  });

  it('shades terrain and labels with glyphs it can load', () => {
    expect(style.layers.some((l) => l.type === 'hillshade')).toBe(true);
    expect(style.glyphs).toContain('{fontstack}');
  });

  it('draws footpaths and trails apart from roads', () => {
    expect(style.layers.map((l) => l.id)).toEqual(
      expect.arrayContaining(['path', 'track', 'park'])
    );
  });
});

describe('outdoorStyleFor', () => {
  it('differs between dark and light', () => {
    expect(outdoorStyleFor(true)).not.toEqual(outdoorStyleFor(false));
  });

  it('hands back the same style object for the same options, so the map is not reloaded', () => {
    expect(outdoorStyleFor(false, { bikeLanes: true })).toBe(
      outdoorStyleFor(false, { bikeLanes: true })
    );
    expect(outdoorStyleFor(false)).toBe(outdoorStyleFor(false, { poi: true, bikeLanes: false }));
  });

  it('differs when a layer is switched', () => {
    expect(outdoorStyleFor(false, { bikeLanes: true })).not.toBe(outdoorStyleFor(false));
  });
});

describe.each(['dark', 'light'] as const)('map layers (%s)', (mode) => {
  const ids = (options?: Parameters<typeof buildOutdoorStyle>[1]) =>
    buildOutdoorStyle(mode, options).layers.map((l) => l.id);

  it('labels places of interest by default and has no bike lanes', () => {
    expect(ids()).toContain('label-park');
    expect(ids()).not.toContain('bike-lanes');
  });

  it('leaves out the place labels when points of interest are switched off', () => {
    expect(ids({ poi: false })).not.toContain('label-park');
    expect(validateStyleMin(buildOutdoorStyle(mode, { poi: false }) as never)).toEqual([]);
  });

  it('draws bike lanes from the cycleway paths when asked, under the labels', () => {
    const style = buildOutdoorStyle(mode, { bikeLanes: true });
    const layer = style.layers.find((l) => l.id === 'bike-lanes');

    expect(layer).toMatchObject({ type: 'line', 'source-layer': 'transportation' });
    expect(JSON.stringify((layer as { filter: unknown }).filter)).toContain('cycleway');
    expect(style.layers.findIndex((l) => l.id === 'bike-lanes')).toBeLessThan(
      style.layers.findIndex((l) => l.id === 'label-water')
    );
    expect(validateStyleMin(style as never)).toEqual([]);
  });
});

describe('widen', () => {
  it('widens the widths and keeps the zoom levels', () => {
    const expression = ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 4];
    expect(widen(expression, 2)).toEqual(['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6]);
  });

  it('draws each road outline wider than the road', () => {
    const style = buildOutdoorStyle('light');
    const stops = (id: string) => {
      const layer = style.layers.find((l) => l.id === id);
      return (layer as { paint: { 'line-width': unknown[] } }).paint['line-width'];
    };
    expect(stops('road-minor-casing')[4]).toBeGreaterThan(stops('road-minor')[4] as number);
    expect(stops('road-minor-casing')[3]).toBe(stops('road-minor')[3]);
  });
});
