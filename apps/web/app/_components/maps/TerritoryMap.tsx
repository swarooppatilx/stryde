'use client';

import type { IControl, Map as MapLibreMapType } from 'maplibre-gl';
import { GeolocateControl, Map as MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import styles from './TerritoryMap.module.css';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const TERRITORY_RING: [number, number][] = [
  [73.847, 18.521],
  [73.849, 18.528],
  [73.856, 18.526],
  [73.854, 18.519],
  [73.847, 18.521],
];

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
  onMapReady?: (map: MapLibreMapType) => void;
};

export function TerritoryMap({ onMapReady }: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const lngs = TERRITORY_RING.map(([lng]) => lng);
    const lats = TERRITORY_RING.map(([, lat]) => lat);
    const center: [number, number] = [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center,
      zoom: 12,
    });

    map.addControl(new NavigationControl(), 'top-left');
    map.addControl(new GeolocateControl({}), 'top-left');
    map.addControl(new PitchToggleControl(), 'top-left');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('error', (e) => console.error('MapLibre error:', e.error));
    requestAnimationFrame(() => map.resize());

    map.on('load', () => {
      map.addSource('territory', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [TERRITORY_RING],
          },
        },
      });

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

      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 0 }
      );

      onMapReady?.(map);
    });

    return () => map.remove();
  }, [onMapReady]);

  return <div ref={containerRef} className={styles.mapContainer} />;
}
