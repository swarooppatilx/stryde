import { describe, expect, it } from 'vitest';
import { FakeGeocoder } from '@/platform/fakes';
import { createPlaceFinder, findPlaces, placeAt } from '@/services/placeSearch';

describe('findPlaces', () => {
  it('names each hit, falling back to its coordinates', async () => {
    const geocoder = new FakeGeocoder();
    geocoder.places.set('pune', [
      { latitude: 18.52, longitude: 73.85 },
      { latitude: 18.6, longitude: 73.9 },
    ]);
    geocoder.names.set('18.52,73.85', 'Pune, Maharashtra, India');

    const results = await findPlaces(geocoder, 'pune');

    expect(results.map((r) => r.name)).toEqual(['Pune, Maharashtra, India', '18.6000, 73.9000']);
    expect(new Set(results.map((r) => r.id)).size).toBe(2);
  });

  it('keeps at most six hits', async () => {
    const geocoder = new FakeGeocoder();
    geocoder.places.set(
      'x',
      Array.from({ length: 9 }, (_, i) => ({ latitude: i, longitude: i }))
    );

    expect(await findPlaces(geocoder, 'x')).toHaveLength(6);
  });

  it('still lists a hit whose name lookup fails', async () => {
    const geocoder = new FakeGeocoder();
    geocoder.places.set('x', [{ latitude: 1, longitude: 2 }]);
    geocoder.placeName = async () => {
      throw new Error('offline');
    };

    expect(await findPlaces(geocoder, 'x')).toEqual([
      { id: '1,2-0', name: '1.0000, 2.0000', latitude: 1, longitude: 2 },
    ]);
  });
});

describe('placeAt', () => {
  it('names a dropped pin from its coordinates', async () => {
    const geocoder = new FakeGeocoder();
    geocoder.names.set('18.52,73.85', 'Shaniwar Wada, Pune');

    expect(await placeAt(geocoder, 18.52, 73.85)).toEqual({
      id: '18.52,73.85',
      name: 'Shaniwar Wada, Pune',
      latitude: 18.52,
      longitude: 73.85,
    });
  });

  it('falls back to the coordinates when the place has no name or the lookup fails', async () => {
    const geocoder = new FakeGeocoder();
    expect((await placeAt(geocoder, 1, 2)).name).toBe('1.0000, 2.0000');

    geocoder.placeName = async () => {
      throw new Error('offline');
    };

    expect((await placeAt(geocoder, 1, 2)).name).toBe('1.0000, 2.0000');
  });
});

describe('createPlaceFinder', () => {
  const seeded = () => {
    const geocoder = new FakeGeocoder();
    geocoder.places.set('pune', [{ latitude: 18.52, longitude: 73.85 }]);
    return geocoder;
  };

  it('asks the geocoder once for a repeated query, however it is typed', async () => {
    const geocoder = seeded();
    const find = createPlaceFinder(geocoder);

    const first = await find('pune');
    const again = await find('  PUNE ');

    expect(again).toEqual(first);
    expect(geocoder.queries).toEqual(['pune']);
  });

  it('does not remember a failed search', async () => {
    const geocoder = seeded();
    const find = createPlaceFinder(geocoder);
    geocoder.failNext = new Error('offline');

    await expect(find('pune')).rejects.toThrow('offline');
    expect(await find('pune')).toHaveLength(1);
  });

  it('forgets the oldest query once it holds too many', async () => {
    const geocoder = seeded();
    const find = createPlaceFinder(geocoder, 2);

    await find('pune');
    await find('a');
    await find('b');
    await find('pune');

    expect(geocoder.queries.filter((q) => q === 'pune')).toHaveLength(2);
  });
});
