import { describe, expect, it, vi } from 'vitest';
import { boundsStop, type CameraRef, createMapCamera, toCameraStop } from '@/components/map-camera';

describe('toCameraStop', () => {
  it('maps a full move to Mapbox names', () => {
    expect(
      toCameraStop({
        center: [73.8, 18.5],
        zoom: 15,
        bearing: 90,
        pitch: 60,
        padding: { bottom: 200 },
        duration: 500,
      })
    ).toEqual({
      centerCoordinate: [73.8, 18.5],
      zoomLevel: 15,
      heading: 90,
      pitch: 60,
      padding: { paddingTop: 0, paddingRight: 0, paddingBottom: 200, paddingLeft: 0 },
      animationMode: 'easeTo',
      animationDuration: 500,
    });
  });

  it('leaves out what was not asked for, so the camera keeps it', () => {
    expect(toCameraStop({ pitch: 0, duration: 300 })).toEqual({
      pitch: 0,
      animationMode: 'easeTo',
      animationDuration: 300,
    });
  });

  it('jumps without a duration', () => {
    expect(toCameraStop({ zoom: 12 })).toEqual({
      zoomLevel: 12,
      animationMode: 'none',
      animationDuration: 0,
    });
  });
});

describe('boundsStop', () => {
  it('turns west-south-east-north into north-east and south-west corners', () => {
    expect(
      boundsStop([73, 18, 74, 19], { padding: { top: 10, bottom: 20 }, duration: 800 })
    ).toEqual({
      bounds: { ne: [74, 19], sw: [73, 18] },
      padding: { paddingTop: 10, paddingRight: 0, paddingBottom: 20, paddingLeft: 0 },
      animationMode: 'easeTo',
      animationDuration: 800,
    });
  });
});

describe('createMapCamera', () => {
  it('sends each call to the native camera as one stop', () => {
    const setCamera = vi.fn();
    const camera = createMapCamera({ current: { setCamera } as unknown as CameraRef });
    camera.zoomTo(14, { duration: 250 });
    expect(setCamera).toHaveBeenCalledWith({
      zoomLevel: 14,
      animationMode: 'easeTo',
      animationDuration: 250,
    });
  });

  it('ignores calls before the native camera exists', () => {
    const camera = createMapCamera({ current: null });
    expect(() => camera.easeTo({ zoom: 3 })).not.toThrow();
  });
});
