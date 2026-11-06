'use client';

import type { IControl, Map as MapLibreMapType } from 'maplibre-gl';
import { GeolocateControl, Map as MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { TerritoryFeatureCollection } from '../../_lib/territories';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Shown when there is no territory to frame yet.
const DEFAULT_CENTER: [number, number] = [73.8567, 18.5204];

function boundsOf(
  collection: TerritoryFeatureCollection
): [[number, number], [number, number]] | null {
  const points = collection.features.flatMap((f) => f.geometry.coordinates[0] ?? []);
  if (points.length === 0) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

class PitchToggleControl implements IControl {
  private button?: HTMLButtonElement;
  private pitched = false;

  onAdd(map: MapLibreMapType) {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '3D';
    button.style.fontWeight = '700';
    button.style.fontSize = '12px';
    button.addEventListener('click', () => {
      this.pitched = !this.pitched;
      map.easeTo({ pitch: this.pitched ? 60 : 0 });
    });

    container.appendChild(button);
    this.button = button;
    return container;
  }

  onRemove() {
    this.button?.remove();
  }
}

type TerritoryMapProps = {
  territories: TerritoryFeatureCollection;
  onMapReady?: (map: MapLibreMapType) => void;
};

export function TerritoryMap({ territories, onMapReady }: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const bounds = boundsOf(territories);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 11,
    });

    map.addControl(new NavigationControl(), 'top-left');
    map.addControl(new GeolocateControl({}), 'top-left');
    map.addControl(new PitchToggleControl(), 'top-left');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('error', (e) => console.error('MapLibre error:', e.error));
    requestAnimationFrame(() => map.resize());

    map.on('load', () => {
      map.addSource('territory', { type: 'geojson', data: territories });

      map.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territory',
        paint: {
          'fill-color': '#E14502',
          'fill-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'territory-outline',
        type: 'line',
        source: 'territory',
        paint: {
          'line-color': '#E14502',
          'line-width': 2,
        },
      });

      if (bounds) map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 15 });

      onMapReady?.(map);
    });

    return () => map.remove();
  }, [territories, onMapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
