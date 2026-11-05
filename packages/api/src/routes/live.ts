import { Hono } from 'hono';
import { getBeacon } from '../lib/arkivFitness.js';

/**
 * Public follow page for a live beacon. Opened from a shared link in any browser, so it can't
 * carry the app key; the run id is unguessable and the beacon expires on Arkiv after 10 minutes.
 */
export const live = new Hono();

const RUN_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

live.get('/:runId/data', async (c) => {
  const runId = c.req.param('runId');
  if (!RUN_ID_RE.test(runId)) return c.json({ error: 'Invalid run id' }, 400);
  const beacon = await getBeacon(runId);
  if (!beacon) return c.json({ error: 'This run has finished or the link expired.' }, 404);
  c.header('Cache-Control', 'no-store');
  return c.json({
    latitude: beacon.latitude,
    longitude: beacon.longitude,
    paceSecPerKm: beacon.paceSecPerKm,
    updatedAt: beacon.updatedAt,
    expiresAt: beacon.expiresAt,
    athlete: `${beacon.athlete.slice(0, 6)}…${beacon.athlete.slice(-4)}`,
    arkivKey: beacon.key,
  });
});

live.get('/:runId', (c) => {
  const runId = c.req.param('runId');
  if (!RUN_ID_RE.test(runId)) return c.text('Invalid link', 400);
  return c.html(page(runId));
});

function page(runId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Live on Stryde</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
<style>
  html, body { margin: 0; height: 100%; background: #0b0b0b; color: #fff; font-family: system-ui, sans-serif; }
  #map { position: absolute; inset: 0; }
  .card { position: absolute; left: 12px; right: 12px; bottom: 16px; z-index: 1000; background: #161616;
    border-radius: 16px; padding: 14px 16px; box-shadow: 0 6px 24px rgba(0,0,0,.5); }
  .row { display: flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 5px; background: #ff4d1a; animation: pulse 1.4s infinite; }
  @keyframes pulse { 50% { opacity: .3; } }
  .muted { color: #9a9a9a; font-size: 13px; margin-top: 4px; }
  .pace { font-size: 22px; font-weight: 700; margin-top: 6px; }
  a.btn { display: block; margin-top: 12px; text-align: center; background: #ff5a1f; color: #fff;
    text-decoration: none; font-weight: 700; padding: 12px; border-radius: 999px; }
</style>
</head>
<body>
<div id="map"></div>
<div class="card">
  <div class="row"><div class="dot" id="dot"></div><strong id="title">Connecting…</strong></div>
  <div class="pace" id="pace"></div>
  <div class="muted" id="meta"></div>
  <a class="btn" href="stryde://live-beacon?runId=${runId}">Open in Stryde</a>
</div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/dark',
    center: [78, 20],
    zoom: 4,
    attributionControl: { compact: true },
  });
  const path = [];
  const trailData = () => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: path } });
  map.on('load', () => {
    map.addSource('trail', { type: 'geojson', data: trailData() });
    map.addLayer({ id: 'trail', type: 'line', source: 'trail',
      paint: { 'line-color': '#ff5a1f', 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  });
  const dotEl = document.createElement('div');
  dotEl.style.cssText = 'width:18px;height:18px;border-radius:9px;background:#ff5a1f;border:3px solid #fff;box-shadow:0 0 0 6px rgba(255,90,31,.25)';
  let marker = null;
  const $ = (id) => document.getElementById(id);
  const pace = (s) => s > 0 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' /km' : 'Warming up';
  async function tick() {
    try {
      const res = await fetch('${runId}/data', { cache: 'no-store' });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Run ended');
      const at = [b.longitude, b.latitude];
      if (!marker) {
        marker = new maplibregl.Marker({ element: dotEl }).setLngLat(at).addTo(map);
        map.jumpTo({ center: at, zoom: 16 });
      } else {
        marker.setLngLat(at);
        map.easeTo({ center: at });
      }
      const last = path[path.length - 1];
      if (!last || last[0] !== at[0] || last[1] !== at[1]) path.push(at);
      map.getSource('trail')?.setData(trailData());
      $('title').textContent = b.athlete + ' is running live';
      $('pace').textContent = pace(b.paceSecPerKm);
      $('meta').textContent = 'Updated ' + new Date(b.updatedAt).toLocaleTimeString() + ' · stored on Arkiv';
    } catch (e) {
      $('dot').style.animation = 'none';
      $('dot').style.background = '#666';
      $('title').textContent = 'Not live right now';
      $('meta').textContent = e.message;
    }
  }
  tick();
  setInterval(tick, 15000);
</script>
</body>
</html>`;
}
