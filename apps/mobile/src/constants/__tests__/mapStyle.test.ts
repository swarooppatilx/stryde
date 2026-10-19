import { describe, expect, it } from 'vitest';
import { offlineMapStyle } from '@/constants/mapStyle';

describe('offlineMapStyle', () => {
  it('is a valid style with no remote sources and just a plain background', () => {
    const style = offlineMapStyle(false);

    expect(style.version).toBe(8);
    expect(style.sources).toEqual({});
    expect(style.layers).toHaveLength(1);
    expect(style.layers[0]).toMatchObject({ id: 'background', type: 'background' });
  });

  it('uses a darker background for dark maps than for light ones', () => {
    const color = (dark: boolean) =>
      (offlineMapStyle(dark).layers[0] as { paint: { 'background-color': string } }).paint[
        'background-color'
      ];

    expect(color(true)).not.toBe(color(false));
  });
});
