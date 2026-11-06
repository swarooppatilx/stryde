'use client';

import type { Map as MapLibreMapType } from 'maplibre-gl';
import { useState } from 'react';
import type { TerritoryFeatureCollection } from '../../_lib/territories';
import { SiteHeader } from '../layout/site-header';
import { MapToolbar } from './map-toolbar';
import { TerritoryMap } from './territory-map';

export function MapScreen({ territories }: { territories: TerritoryFeatureCollection }) {
  const [map, setMap] = useState<MapLibreMapType | null>(null);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#faf9f8]">
      <SiteHeader />
      <div className="relative flex-1">
        <TerritoryMap territories={territories} onMapReady={setMap} />
        <MapToolbar map={map} />
      </div>
    </div>
  );
}
