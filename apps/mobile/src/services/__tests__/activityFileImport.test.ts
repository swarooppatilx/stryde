import { describe, expect, it } from 'vitest';
import { buildPreview, parseActivityFile } from '@/services/activityFileImport';
import { encoder, FIT_EPOCH_S, type FieldSpec, fitFile } from '@/utils/__tests__/fitEncoder';

const START = Date.parse('2026-10-16T06:00:00Z');
const gpx = Array.from(
  { length: 6 },
  (_, i) =>
    `<trkpt lat="${18.5 + i * 0.0003}" lon="73.8"><time>${new Date(START + i * 10_000).toISOString()}</time></trkpt>`
).join('');
const GPX = `<gpx><trk><name>Loop</name><trkseg>${gpx}</trkseg></trk></gpx>`;
const options = { splitMeters: 1000 };

describe('parseActivityFile', () => {
  it('reads a FIT file by its extension', () => {
    const e = encoder();
    const fields: FieldSpec[] = [
      [253, 'uint32'],
      [0, 'sint32'],
      [1, 'sint32'],
    ];
    const start = Math.floor(START / 1000) - FIT_EPOCH_S;
    const body = [
      ...e.definition(0, 20, fields),
      ...Array.from({ length: 6 }, (_, i) =>
        e.data(0, fields, [
          start + i * 10,
          Math.round((18.5 + i * 0.0003) * (2 ** 31 / 180)),
          Math.round(73.8 * (2 ** 31 / 180)),
        ])
      ).flat(),
    ];
    const result = parseActivityFile('loop.FIT', fitFile(body), options);
    expect(result.ok && result.items).toHaveLength(1);
    expect(result.ok && result.items[0]?.input.description).toBe('Imported from a FIT file');
  });

  it('says a damaged FIT file is damaged', () => {
    const e = encoder();
    const body = e.definition(0, 20, [[253, 'uint32']]);
    expect(parseActivityFile('a.fit', fitFile(body, { corruptCrc: true }), options)).toEqual({
      ok: false,
      message: 'a.fit is damaged and cannot be read.',
    });
  });

  it('reads a GPX file into one item', () => {
    const result = parseActivityFile('loop.gpx', GPX, options);
    expect(result.ok && result.items).toHaveLength(1);
    expect(result.ok && result.items[0]?.input.title).toBe('Loop');
  });

  it('says plainly what is wrong with a file', () => {
    expect(parseActivityFile('a.gpx', '<nope>', options)).toEqual({
      ok: false,
      message: 'a.gpx is not a readable GPX file.',
    });
    expect(parseActivityFile('a.tcx', '<nope>', options)).toEqual({
      ok: false,
      message: 'a.tcx is not a readable TCX file.',
    });
    expect(parseActivityFile('a.fit', new Uint8Array([1, 2, 3]), options)).toEqual({
      ok: false,
      message: 'a.fit is not a readable FIT file.',
    });
    expect(parseActivityFile('a.kml', 'x', options)).toEqual({
      ok: false,
      message: 'a.kml is not a GPX, TCX or FIT file.',
    });
    const untimed = GPX.replaceAll(/<time>.*?<\/time>/g, '');
    expect(parseActivityFile('a.gpx', untimed, options)).toEqual({
      ok: false,
      message: 'a.gpx has no times on its points.',
    });
  });
});

describe('buildPreview', () => {
  const parsed = parseActivityFile('loop.gpx', GPX, options);
  const items = parsed.ok ? parsed.items : [];
  const files = [{ fileName: 'loop.gpx', items }];

  it('ticks new activities and leaves a saved look-alike unticked', () => {
    expect(buildPreview(files, [])[0]).toMatchObject({ duplicate: false, selected: true });
    const own = [{ createdAt: START, duration: 50_000, distance: items[0]?.input.distance ?? 0 }];
    expect(buildPreview(files, own)[0]).toMatchObject({ duplicate: true, selected: false });
  });

  it('marks the second copy of the same track in one batch', () => {
    const both = buildPreview([...files, { fileName: 'copy.gpx', items }], []);
    expect(both.map((p) => p.duplicate)).toEqual([false, true]);
  });
});
