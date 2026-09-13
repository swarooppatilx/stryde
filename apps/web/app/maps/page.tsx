'use client';

import type { Map as MapLibreMapType } from 'maplibre-gl';
import { useState } from 'react';
import { SiteHeader } from '../_components/home/SiteHeader';
import { MapToolbar } from '../_components/maps/MapToolbar';
import { TerritoryMap } from '../_components/maps/TerritoryMap';
import styles from './page.module.css';

export default function MapsPage() {
  const [map, setMap] = useState<MapLibreMapType | null>(null);

  return (
    <div className={styles.pageWrap}>
      <SiteHeader />
      <div className={styles.mapArea}>
        <TerritoryMap onMapReady={setMap} />
        <MapToolbar map={map} />
      </div>
    </div>
  );
}
