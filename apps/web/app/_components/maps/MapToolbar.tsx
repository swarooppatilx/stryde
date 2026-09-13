'use client';

import { Loader2, Search } from 'lucide-react';
import type { Map as MapLibreMapType } from 'maplibre-gl';
import { Marker } from 'maplibre-gl';
import { useRef, useState } from 'react';
import styles from './MapToolbar.module.css';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type MapToolbarProps = {
  map: MapLibreMapType | null;
};

export function MapToolbar({ map }: MapToolbarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || !map) return;

    setIsSearching(true);
    setError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Search failed');

      const results: NominatimResult[] = await response.json();
      const top = results[0];
      if (!top) {
        setError('No results found');
        return;
      }

      const center: [number, number] = [Number.parseFloat(top.lon), Number.parseFloat(top.lat)];
      map.flyTo({ center, zoom: 14 });

      if (markerRef.current) {
        markerRef.current.setLngLat(center);
      } else {
        markerRef.current = new Marker({ color: '#E14502' }).setLngLat(center).addTo(map);
      }
    } catch {
      setError('Search failed — try again');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchBox}>
        {isSearching ? (
          <Loader2 size={16} className={styles.spinner} />
        ) : (
          <Search size={16} className={styles.searchIcon} />
        )}
        <input
          type="text"
          placeholder="Search for a location"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
        />
      </div>
      {error && <div className={styles.errorBubble}>{error}</div>}
    </div>
  );
}
