import type {
  FillLayerSpecification,
  LayerSpecification,
  StyleSpecification,
} from '@maplibre/maplibre-react-native';

/** Outdoor basemap from OpenFreeMap vector tiles (OpenMapTiles schema) and AWS open terrain tiles for shading; both keyless. */

const VECTOR = 'openmaptiles';
const DEM = 'terrain';

export type OutdoorMapMode = 'dark' | 'light';

/** Optional overlays on the base map; places of interest are labelled unless switched off. */
export interface OutdoorLayerOptions {
  poi?: boolean;
  bikeLanes?: boolean;
}

const BIKE_LANE_COLOR = '#1E9E5A';

interface Palette {
  land: string;
  grass: string;
  wood: string;
  wetland: string;
  sand: string;
  park: string;
  pitch: string;
  residential: string;
  institution: string;
  water: string;
  waterway: string;
  building: string;
  roadCasing: string;
  roadMinor: string;
  roadMajor: string;
  roadHighway: string;
  path: string;
  track: string;
  rail: string;
  boundary: string;
  label: string;
  labelMuted: string;
  labelGreen: string;
  labelWater: string;
  halo: string;
  shadow: string;
  highlight: string;
  shading: number;
}

const DARK: Palette = {
  land: '#262c35',
  grass: '#2a463f',
  wood: '#24413b',
  wetland: '#2a4a4a',
  sand: '#3a3b3e',
  park: '#2b4a43',
  pitch: '#31554a',
  residential: '#2a303a',
  institution: '#2d333d',
  water: '#1f4a5c',
  waterway: '#26566a',
  building: '#303744',
  roadCasing: '#1b2027',
  roadMinor: '#484e5e',
  roadMajor: '#60667c',
  roadHighway: '#7a6fa8',
  path: '#8f78e6',
  track: '#6f6a78',
  rail: '#4a4f5c',
  boundary: '#5a5f70',
  label: '#d4d1d8',
  labelMuted: '#9a98a3',
  labelGreen: '#7cc7a6',
  labelWater: '#78b6cf',
  halo: '#1a1e25',
  shadow: '#000000',
  highlight: '#6d7c8c',
  shading: 0.45,
};

const LIGHT: Palette = {
  land: '#f3f0ea',
  grass: '#d3e8c6',
  wood: '#bddcae',
  wetland: '#cfe4d6',
  sand: '#eadfc2',
  park: '#cbe6bd',
  pitch: '#b7dca7',
  residential: '#ece8e0',
  institution: '#ebe5dc',
  water: '#a9d3ea',
  waterway: '#8fc1de',
  building: '#e1dcd2',
  roadCasing: '#cfc9bd',
  roadMinor: '#ffffff',
  roadMajor: '#fff3d6',
  roadHighway: '#f9c88a',
  path: '#7a4fd6',
  track: '#b49a72',
  rail: '#b8b3a8',
  boundary: '#a49fb0',
  label: '#2f2e33',
  labelMuted: '#6e6c74',
  labelGreen: '#2f7a4f',
  labelWater: '#2a6d94',
  halo: '#fffdf8',
  shadow: '#6b5f4f',
  highlight: '#ffffff',
  shading: 0.3,
};

const isOneOf = (field: string, values: readonly string[]) => [
  'match',
  ['get', field],
  [...values],
  true,
  false,
];

const NOT_TUNNEL = ['!=', ['get', 'brunnel'], 'tunnel'];
const LINES = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];

const widths = (...stops: number[]) => ['interpolate', ['linear'], ['zoom'], ...stops];

const CASING_EXTRA_PX = 1.6;

/** Adds `extra` to every width stop of a zoom interpolation, leaving the zoom levels alone. */
export function widen(expression: unknown[], extra: number): unknown[] {
  // ['interpolate', ['linear'], ['zoom'], zoom, width, zoom, width, ...]
  return expression.map((v, i) => (i >= 4 && i % 2 === 0 ? (v as number) + extra : v));
}

const MINOR = ['minor', 'street', 'street_limited', 'service'];
const MAJOR = ['secondary', 'tertiary'];
const HIGHWAY = ['primary', 'trunk'];
const MOTORWAY = ['motorway'];

const NAME = ['coalesce', ['get', 'name_en'], ['get', 'name']];

function roadLayers(p: Palette): LayerSpecification[] {
  const road = (
    id: string,
    classes: readonly string[],
    color: string,
    width: unknown[],
    minzoom = 5
  ): LayerSpecification[] => [
    {
      id: `${id}-casing`,
      type: 'line',
      source: VECTOR,
      'source-layer': 'transportation',
      minzoom,
      filter: ['all', LINES, NOT_TUNNEL, isOneOf('class', classes)] as never,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.roadCasing,
        'line-width': widen(width, CASING_EXTRA_PX) as never,
      },
    },
    {
      id,
      type: 'line',
      source: VECTOR,
      'source-layer': 'transportation',
      minzoom,
      filter: ['all', LINES, NOT_TUNNEL, isOneOf('class', classes)] as never,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': width as never },
    },
  ];
  return [
    ...road('road-minor', MINOR, p.roadMinor, widths(12, 0.4, 14, 1.6, 17, 6), 12),
    ...road('road-major', MAJOR, p.roadMajor, widths(8, 0.4, 12, 1.6, 14, 3, 17, 9), 8),
    ...road('road-highway', HIGHWAY, p.roadHighway, widths(6, 0.5, 12, 2, 14, 4, 17, 11), 6),
    ...road('road-motorway', MOTORWAY, p.roadHighway, widths(5, 0.5, 12, 2.4, 14, 4.6, 17, 12), 5),
  ];
}

function pathLayers(p: Palette): LayerSpecification[] {
  return [
    {
      id: 'track',
      type: 'line',
      source: VECTOR,
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', LINES, NOT_TUNNEL, isOneOf('class', ['track'])] as never,
      layout: { 'line-cap': 'butt' },
      paint: {
        'line-color': p.track,
        'line-width': widths(13, 0.6, 17, 2.2) as never,
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'path',
      type: 'line',
      source: VECTOR,
      'source-layer': 'transportation',
      minzoom: 12.5,
      filter: ['all', LINES, NOT_TUNNEL, isOneOf('class', ['path', 'pedestrian'])] as never,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.path,
        'line-width': widths(12.5, 0.5, 15, 1.1, 17, 2.4) as never,
        'line-dasharray': [2.2, 1.4],
        'line-opacity': 0.95,
      },
    },
    {
      id: 'rail',
      type: 'line',
      source: VECTOR,
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', LINES, isOneOf('class', ['rail', 'transit'])] as never,
      paint: {
        'line-color': p.rail,
        'line-width': widths(11, 0.5, 16, 1.6) as never,
        'line-dasharray': [4, 3],
      },
    },
  ];
}

function labelLayers(p: Palette, poi: boolean): LayerSpecification[] {
  const text = (size: unknown[]) => ({
    'text-field': NAME as never,
    'text-size': size as never,
    'text-max-width': 8,
  });
  const paint = (color: string, halo = 1.4) => ({
    'text-color': color,
    'text-halo-color': p.halo,
    'text-halo-width': halo,
    'text-halo-blur': 0.4,
  });
  return [
    {
      id: 'label-water',
      type: 'symbol',
      source: VECTOR,
      'source-layer': 'water_name',
      minzoom: 8,
      layout: { ...text(widths(8, 10, 14, 13)), 'text-font': ['Noto Sans Italic'] },
      paint: paint(p.labelWater),
    },
    {
      id: 'label-road-major',
      type: 'symbol',
      source: VECTOR,
      'source-layer': 'transportation_name',
      minzoom: 12.2,
      filter: isOneOf('class', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']) as never,
      layout: {
        ...text(widths(12, 11, 16, 14)),
        'symbol-placement': 'line',
        'text-font': ['Noto Sans Regular'],
        'text-rotation-alignment': 'map',
      },
      paint: paint(p.label),
    },
    {
      id: 'label-road-minor',
      type: 'symbol',
      source: VECTOR,
      'source-layer': 'transportation_name',
      minzoom: 14.5,
      filter: isOneOf('class', [
        'minor',
        'street',
        'street_limited',
        'service',
        'path',
        'pedestrian',
      ]) as never,
      layout: {
        ...text(widths(14, 10, 17, 13)),
        'symbol-placement': 'line',
        'text-font': ['Noto Sans Regular'],
        'text-rotation-alignment': 'map',
      },
      paint: paint(p.labelMuted),
    },
    ...(poi
      ? ([
          {
            id: 'label-park',
            type: 'symbol',
            source: VECTOR,
            'source-layer': 'poi',
            minzoom: 13.5,
            filter: isOneOf('class', ['park', 'garden', 'stadium']) as never,
            layout: { ...text(widths(13, 10, 17, 13)), 'text-font': ['Noto Sans Italic'] },
            paint: paint(p.labelGreen),
          },
        ] as LayerSpecification[])
      : []),
    {
      id: 'label-place-small',
      type: 'symbol',
      source: VECTOR,
      'source-layer': 'place',
      minzoom: 11,
      maxzoom: 17,
      filter: isOneOf('class', [
        'suburb',
        'quarter',
        'neighbourhood',
        'hamlet',
        'isolated_dwelling',
      ]) as never,
      layout: {
        ...text(widths(11, 10, 16, 13)),
        'text-font': ['Noto Sans Regular'],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
      },
      paint: paint(p.labelMuted),
    },
    {
      id: 'label-place-large',
      type: 'symbol',
      source: VECTOR,
      'source-layer': 'place',
      minzoom: 5,
      filter: isOneOf('class', ['city', 'town', 'village']) as never,
      layout: {
        ...text(widths(5, 11, 10, 15, 14, 18)),
        'text-font': ['Noto Sans Bold'],
      },
      paint: paint(p.label, 1.8),
    },
  ];
}

/** Pure: the same mode always gives the same style. */
export function buildOutdoorStyle(
  mode: OutdoorMapMode,
  { poi = true, bikeLanes = false }: OutdoorLayerOptions = {}
): StyleSpecification {
  const p = mode === 'dark' ? DARK : LIGHT;
  const fill = (
    id: string,
    sourceLayer: string,
    color: string,
    classes?: readonly string[],
    opacity = 1
  ): FillLayerSpecification => ({
    id,
    type: 'fill',
    source: VECTOR,
    'source-layer': sourceLayer,
    ...(classes ? { filter: isOneOf('class', classes) as never } : {}),
    paint: { 'fill-color': color, 'fill-opacity': opacity },
  });

  return {
    version: 8,
    name: `Stryde outdoor ${mode}`,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      [VECTOR]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', maxzoom: 14 },
      [DEM]: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.land } },
      fill('landcover-grass', 'landcover', p.grass, ['grass', 'farmland']),
      fill('landcover-wood', 'landcover', p.wood, ['wood']),
      fill('landcover-wetland', 'landcover', p.wetland, ['wetland']),
      fill('landcover-sand', 'landcover', p.sand, ['sand', 'rock']),
      fill('landuse-residential', 'landuse', p.residential, [
        'residential',
        'suburb',
        'neighbourhood',
      ]),
      fill('landuse-institution', 'landuse', p.institution, [
        'school',
        'hospital',
        'cemetery',
        'university',
        'college',
      ]),
      fill('landuse-green', 'landuse', p.pitch, ['pitch', 'playground', 'track', 'stadium']),
      {
        ...fill('park', 'park', p.park),
        minzoom: 6,
        paint: { 'fill-color': p.park, 'fill-opacity': 0.75 },
      },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: DEM,
        paint: {
          'hillshade-exaggeration': p.shading,
          'hillshade-shadow-color': p.shadow,
          'hillshade-highlight-color': p.highlight,
          'hillshade-accent-color': p.shadow,
        },
      },
      { ...fill('water', 'water', p.water), filter: NOT_TUNNEL as never },
      {
        id: 'waterway',
        type: 'line',
        source: VECTOR,
        'source-layer': 'waterway',
        minzoom: 11,
        filter: isOneOf('class', ['river', 'canal', 'stream']) as never,
        paint: { 'line-color': p.waterway, 'line-width': widths(11, 0.6, 16, 3) as never },
      },
      {
        id: 'building',
        type: 'fill',
        source: VECTOR,
        'source-layer': 'building',
        minzoom: 14.5,
        paint: { 'fill-color': p.building, 'fill-opacity': 0.85 },
      },
      ...roadLayers(p),
      ...pathLayers(p),
      ...(bikeLanes
        ? ([
            {
              id: 'bike-lanes',
              type: 'line',
              source: VECTOR,
              'source-layer': 'transportation',
              minzoom: 10,
              filter: ['all', ['==', ['get', 'subclass'], 'cycleway']] as never,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': BIKE_LANE_COLOR, 'line-width': widths(10, 1, 16, 3) as never },
            },
          ] as LayerSpecification[])
        : []),
      {
        id: 'boundary',
        type: 'line',
        source: VECTOR,
        'source-layer': 'boundary',
        maxzoom: 10,
        filter: ['<=', ['get', 'admin_level'], 4] as never,
        paint: { 'line-color': p.boundary, 'line-width': 0.8, 'line-dasharray': [4, 3] },
      },
      ...labelLayers(p, poi),
    ],
  };
}

const styleCache = new Map<string, StyleSpecification>();

/** The same options always give the same object, so the map is not told its style changed when it did not. */
export function outdoorStyleFor(
  dark: boolean,
  { poi = true, bikeLanes = false }: OutdoorLayerOptions = {}
): StyleSpecification {
  const key = `${dark ? 'dark' : 'light'}:${poi}:${bikeLanes}`;
  let style = styleCache.get(key);
  if (!style) {
    style = buildOutdoorStyle(dark ? 'dark' : 'light', { poi, bikeLanes });
    styleCache.set(key, style);
  }
  return style;
}
