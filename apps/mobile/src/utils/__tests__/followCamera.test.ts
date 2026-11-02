import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  buildTarget,
  type CameraTarget,
  clampZoom,
  classifyViewChange,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeBearing,
  shouldEase,
  smoothHeading,
  stepZoom,
  TILT_DEGREES,
} from '@/utils/followCamera';

const target = (over: Partial<CameraTarget> = {}): CameraTarget => ({
  center: [73.85, 18.52],
  zoom: 16,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  ...over,
});

describe('angles', () => {
  it('wraps bearings into 0..360', () => {
    expect(normalizeBearing(-10)).toBe(350);
    expect(normalizeBearing(370)).toBe(10);
  });

  it('takes the shortest arc across north', () => {
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
  });
});

describe('smoothHeading', () => {
  it('adopts the course on the first moving fix', () => {
    expect(smoothHeading(null, { bearing: 90, speed: 3 })).toBe(90);
  });

  it('keeps the last heading when standing still or without a course', () => {
    expect(smoothHeading(40, { bearing: 200, speed: 0.3 })).toBe(40);
    expect(smoothHeading(40, { speed: 3 })).toBe(40);
    expect(smoothHeading(null, { bearing: 200 })).toBeNull();
  });

  it('blends towards the course along the shortest arc', () => {
    const next = smoothHeading(350, { bearing: 10, speed: 3 }) as number;
    expect(angleDelta(350, next)).toBeGreaterThan(0);
    expect(angleDelta(350, next)).toBeLessThan(20);
  });
});

describe('zoom', () => {
  it('clamps to the tracker range', () => {
    expect(clampZoom(3)).toBe(MIN_ZOOM);
    expect(clampZoom(25)).toBe(MAX_ZOOM);
    expect(clampZoom(15.5)).toBe(15.5);
  });

  it('steps one level and stops at the ends', () => {
    expect(stepZoom(16, 1)).toBe(17);
    expect(stepZoom(16, -1)).toBe(15);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
});

describe('shouldEase', () => {
  it('eases to the first target', () => {
    expect(shouldEase(null, target())).toBe(true);
  });

  it('ignores a sub-1.5 m move and a small turn', () => {
    expect(shouldEase(target(), target({ center: [73.850005, 18.52] }))).toBe(false);
    expect(shouldEase(target({ bearing: 355 }), target({ bearing: 2 }))).toBe(false);
  });

  it('eases on a real move, a real turn, a zoom change or new padding', () => {
    expect(shouldEase(target(), target({ center: [73.85003, 18.52] }))).toBe(true);
    expect(shouldEase(target({ bearing: 350 }), target({ bearing: 5 }))).toBe(true);
    expect(shouldEase(target(), target({ zoom: 17 }))).toBe(true);
    expect(
      shouldEase(target(), target({ padding: { top: 200, right: 0, bottom: 0, left: 0 } }))
    ).toBe(true);
  });
});

describe('buildTarget', () => {
  const base = {
    position: [73.85, 18.52] as [number, number],
    zoom: 16.4,
    heading: 120,
    currentBearing: 33,
    mapHeight: 600,
  };

  it('keeps north up and centred', () => {
    expect(buildTarget({ ...base, mode: 'north' })).toEqual({
      center: base.position,
      zoom: 16.4,
      bearing: 0,
      pitch: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it('lifts the puck above the bottom controls', () => {
    const t = buildTarget({ ...base, mode: 'north', bottomInset: 180 });
    expect(t.padding).toEqual({ top: 0, right: 0, bottom: 180, left: 0 });
  });

  it('keeps the heading-up puck in the lower third of what the controls leave visible', () => {
    const t = buildTarget({ ...base, mode: 'heading', bottomInset: 120 });
    expect(t.padding.bottom).toBe(120);
    expect(t.padding.top).toBe(160);
  });

  it('tilts only when asked, and a change of tilt or inset eases the camera', () => {
    expect(buildTarget({ ...base, mode: 'north', tilted: true }).pitch).toBe(TILT_DEGREES);
    const flat = buildTarget({ ...base, mode: 'north' });
    expect(shouldEase(flat, buildTarget({ ...base, mode: 'north', tilted: true }))).toBe(true);
    expect(shouldEase(flat, buildTarget({ ...base, mode: 'north', bottomInset: 90 }))).toBe(true);
  });

  it('turns to the heading and sits the puck in the lower third', () => {
    const t = buildTarget({ ...base, mode: 'heading' });
    expect(t.bearing).toBe(120);
    expect(t.padding.top).toBe(200);
  });

  it('holds the current bearing until a heading is known, and clamps the zoom', () => {
    const t = buildTarget({ ...base, mode: 'heading', heading: null, zoom: 30 });
    expect(t.bearing).toBe(33);
    expect(t.zoom).toBe(MAX_ZOOM);
  });
});

describe('classifyViewChange', () => {
  const view = { center: [73.85, 18.52] as [number, number], zoom: 16, bearing: 0 };

  it('sees a drag as a pan', () => {
    expect(classifyViewChange(view, { ...view, center: [73.8512, 18.52] })).toBe('pan');
  });

  it('sees a pinch as a zoom, even if the centre drifts', () => {
    expect(classifyViewChange(view, { ...view, zoom: 17, center: [73.8505, 18.5203] })).toBe(
      'zoom'
    );
  });

  it('sees a twist as a rotation', () => {
    expect(classifyViewChange(view, { ...view, bearing: 40 })).toBe('rotate');
  });

  it('ignores a jitter', () => {
    expect(classifyViewChange(view, { ...view, center: [73.850001, 18.52] })).toBe('none');
  });
});
