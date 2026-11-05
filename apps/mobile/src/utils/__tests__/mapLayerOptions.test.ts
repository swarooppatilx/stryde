import { describe, expect, it } from 'vitest';
import { MAP_LAYER_OPTIONS } from '@/utils/mapLayerOptions';

describe('map layer options', () => {
  const layers = ['routes', 'heatmap', 'others', 'poi', 'bikeLanes'] as const;

  it('describe every layer the map can switch, in plain words', () => {
    for (const layer of layers) {
      const option = MAP_LAYER_OPTIONS[layer];
      expect(option.label.length).toBeGreaterThan(2);
      expect(option.hint.length).toBeGreaterThan(5);
      expect(option.icon).toBeTruthy();
    }
  });

  it('give each layer its own label, so the sheet never shows two the same', () => {
    const labels = layers.map((layer) => MAP_LAYER_OPTIONS[layer].label);
    expect(new Set(labels).size).toBe(layers.length);
  });
});
