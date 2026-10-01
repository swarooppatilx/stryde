'use client';

import type { Map as MapLibreMapType } from 'maplibre-gl';
import { useState } from 'react';
import type { TerritoryFeatureCollection } from '../../_lib/territories';
import styles from '../../maps/page.module.css';
import { SiteHeader } from '../home/SiteHeader';
import { MapToolbar } from './MapToolbar';
import { TerritoryMap } from './TerritoryMap';

export function MapScreen({ territories }: { territories: TerritoryFeatureCollection }) {
  const [map, setMap] = useState<MapLibreMapType | null>(null);

  return (
    <div className={styles.pageWrap}>
      <SiteHeader />
      <div className={styles.mapArea}>
        <TerritoryMap territories={territories} onMapReady={setMap} />
        <MapToolbar map={map} />
      </div>
    </div>
  );
}
