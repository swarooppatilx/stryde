import { MapScreen } from '../_components/maps/MapScreen';
import { fetchTerritories } from '../_lib/territories';

export default async function MapsPage() {
  // A subgraph outage shows the plain map rather than an error page.
  const territories = (await fetchTerritories()) ?? {
    type: 'FeatureCollection' as const,
    features: [],
  };

  return <MapScreen territories={territories} />;
}
