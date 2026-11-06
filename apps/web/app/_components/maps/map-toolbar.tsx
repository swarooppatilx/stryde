'use client';

import { Loader2, Search } from 'lucide-react';
import type { Map as MapLibreMapType } from 'maplibre-gl';
import { Marker } from 'maplibre-gl';
import { useRef, useState } from 'react';

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
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        trimmed
      )}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
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
    <div className="absolute left-6 top-6 z-10 flex flex-col gap-2">
      <div className="flex min-w-[280px] items-center gap-2.5 rounded-full border border-[#ebecee] bg-white/95 px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
        {isSearching ? (
          <Loader2 size={16} className="shrink-0 animate-spin text-[var(--color-brand)]" />
        ) : (
          <Search size={16} className="shrink-0 text-[#7a828a]" />
        )}
        <input
          type="text"
          placeholder="Search coordinates or city"
          className="w-full border-none bg-transparent text-[14px] text-[#0b0e14] outline-none placeholder:text-[#7a828a]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runSearch();
          }}
        />
      </div>
      {error && (
        <div className="rounded-full border border-[#e14502]/20 bg-white px-4 py-1.5 text-[12px] font-medium text-[var(--color-brand)] shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}
