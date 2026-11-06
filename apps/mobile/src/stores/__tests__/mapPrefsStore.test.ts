import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useMapPrefsStore, hasActiveFilters, isLayerOn, layerBadgeCount } = await import(
  '@/stores/mapPrefsStore'
);

beforeEach(() => {
  installFakePlatform();
  useMapPrefsStore.getState().reset();
});

describe('map preferences', () => {
  it('starts with every layer off and every filter open', () => {
    const s = useMapPrefsStore.getState();

    expect([s.showRoutes, s.showHeatmap, s.showOthers]).toEqual([false, false, false]);
    expect([s.sport, s.time, s.distance]).toEqual(['all', 'all', 'any']);
    expect(hasActiveFilters(s)).toBe(false);
  });

  it('remembers layers and filters that were set', () => {
    const { setLayer, setSport, setTime, setDistance } = useMapPrefsStore.getState();

    setLayer('routes', true);
    setSport('run');
    setTime('7d');
    setDistance('long');

    const s = useMapPrefsStore.getState();
    expect(s.showRoutes).toBe(true);
    expect([s.sport, s.time, s.distance]).toEqual(['run', '7d', 'long']);
    expect(hasActiveFilters(s)).toBe(true);
  });

  it('clears the filters but keeps the layers on', () => {
    const { setLayer, setSport, setTime, clearFilters } = useMapPrefsStore.getState();
    setLayer('heatmap', true);
    setSport('ride');
    setTime('30d');

    clearFilters();

    const s = useMapPrefsStore.getState();
    expect(s.showHeatmap).toBe(true);
    expect(hasActiveFilters(s)).toBe(false);
  });
});

describe('map style', () => {
  it('follows the app theme until a style is chosen, and remembers the choice', () => {
    expect(useMapPrefsStore.getState().style).toBe('auto');

    useMapPrefsStore.getState().setStyle('light');

    expect(useMapPrefsStore.getState().style).toBe('light');
  });

  it('stays chosen when filters are cleared', () => {
    useMapPrefsStore.getState().setStyle('dark');

    useMapPrefsStore.getState().clearFilters();

    expect(useMapPrefsStore.getState().style).toBe('dark');
  });
});

describe('resolveMapStyle', () => {
  it('uses the app theme for auto and the chosen style otherwise', async () => {
    const { resolveMapStyle } = await import('@/stores/mapPrefsStore');

    expect(resolveMapStyle('auto', true)).toBe('dark');
    expect(resolveMapStyle('auto', false)).toBe('light');
    expect(resolveMapStyle('light', true)).toBe('light');
    expect(resolveMapStyle('dark', false)).toBe('dark');
  });
});

describe('recording follow mode', () => {
  it('starts north-up and remembers heading-up', () => {
    expect(useMapPrefsStore.getState().recordFollowMode).toBe('north');

    useMapPrefsStore.getState().setRecordFollowMode('heading');

    expect(useMapPrefsStore.getState().recordFollowMode).toBe('heading');
  });

  it('goes back to north-up on reset', () => {
    useMapPrefsStore.getState().setRecordFollowMode('heading');
    useMapPrefsStore.getState().reset();

    expect(useMapPrefsStore.getState().recordFollowMode).toBe('north');
  });
});

describe('map overlays', () => {
  it('label places of interest by default and leave bike lanes off', () => {
    const s = useMapPrefsStore.getState();

    expect(s.showPoi).toBe(true);
    expect(s.showBikeLanes).toBe(false);
  });

  it('switch places of interest and bike lanes independently', () => {
    const { setLayer } = useMapPrefsStore.getState();

    setLayer('poi', false);
    setLayer('bikeLanes', true);

    expect(useMapPrefsStore.getState()).toMatchObject({ showPoi: false, showBikeLanes: true });
  });

  it('are restored by reset', () => {
    const { setLayer, reset } = useMapPrefsStore.getState();
    setLayer('poi', false);
    setLayer('bikeLanes', true);

    reset();

    expect(useMapPrefsStore.getState()).toMatchObject({ showPoi: true, showBikeLanes: false });
  });
});

describe('layerBadgeCount', () => {
  const none = { showRoutes: false, showHeatmap: false, showOthers: false, showBikeLanes: false };

  it('counts nothing when no overlay is on', () => {
    expect(layerBadgeCount(none)).toBe(0);
  });

  it('counts each overlay that is on, for the badge on the layers button', () => {
    expect(layerBadgeCount({ ...none, showHeatmap: true })).toBe(1);
    expect(layerBadgeCount({ ...none, showSegments: true })).toBe(1);
    expect(layerBadgeCount({ ...none, showRoutes: true, showBikeLanes: true })).toBe(2);
    expect(
      layerBadgeCount({
        showRoutes: true,
        showHeatmap: true,
        showOthers: true,
        showBikeLanes: true,
      })
    ).toBe(4);
  });
});

describe('isLayerOn', () => {
  it('reads the switch that belongs to each layer', () => {
    const prefs = {
      showRoutes: true,
      showHeatmap: false,
      showOthers: true,
      showPoi: false,
      showBikeLanes: true,
      showSegments: true,
    };

    expect(isLayerOn(prefs, 'routes')).toBe(true);
    expect(isLayerOn(prefs, 'heatmap')).toBe(false);
    expect(isLayerOn(prefs, 'others')).toBe(true);
    expect(isLayerOn(prefs, 'poi')).toBe(false);
    expect(isLayerOn(prefs, 'bikeLanes')).toBe(true);
    expect(isLayerOn(prefs, 'segments')).toBe(true);
  });
});

describe('heatmap colour', () => {
  it('starts classic, remembers a choice, and goes back to classic on reset', () => {
    expect(useMapPrefsStore.getState().heatmapColor).toBe('classic');

    useMapPrefsStore.getState().setHeatmapColor('sunset');
    expect(useMapPrefsStore.getState().heatmapColor).toBe('sunset');

    useMapPrefsStore.getState().reset();
    expect(useMapPrefsStore.getState().heatmapColor).toBe('classic');
  });

  it('is not a layer: picking a colour does not switch the heatmap on or change the badge', () => {
    useMapPrefsStore.getState().setHeatmapColor('blue');
    expect(useMapPrefsStore.getState().showHeatmap).toBe(false);
    expect(layerBadgeCount(useMapPrefsStore.getState())).toBe(0);
  });
});
