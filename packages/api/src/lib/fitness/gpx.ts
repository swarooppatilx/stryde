import type { TimedPoint } from './geo.js';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toGpx(name: string, points: TimedPoint[], heartRates?: number[]): string {
  const trkpts = points
    .map((p, i) => {
      const hr = heartRates?.[i];
      const ext =
        hr === undefined
          ? ''
          : `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hr)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`;
      return `<trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}"><time>${new Date(p.timestamp).toISOString()}</time>${ext}</trkpt>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<gpx version="1.1" creator="Stryde" xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">' +
    `<trk><name>${escapeXml(name)}</name><trkseg>${trkpts}</trkseg></trk></gpx>`
  );
}
