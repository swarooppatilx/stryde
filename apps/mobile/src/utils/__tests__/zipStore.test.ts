import { describe, expect, it } from 'vitest';
import { crc32, zipStore } from '@/utils/zipStore';
import { unzipStore } from './unzipStore';

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('zipStore', () => {
  it('reads back every file with its bytes intact', () => {
    const binary = Uint8Array.from([0, 1, 2, 250, 255]);
    const zip = zipStore([
      { name: 'a.gpx', data: '<gpx/>' },
      { name: 'folder/é.json', data: '{"ü":1}' },
      { name: 'raw.bin', data: binary },
    ]);
    const files = unzipStore(zip);
    expect([...files.keys()]).toEqual(['a.gpx', 'folder/é.json', 'raw.bin']);
    expect(new TextDecoder().decode(files.get('a.gpx'))).toBe('<gpx/>');
    expect(new TextDecoder().decode(files.get('folder/é.json'))).toBe('{"ü":1}');
    expect([...(files.get('raw.bin') ?? [])]).toEqual([...binary]);
  });

  it('starts with a local header and ends with the end record', () => {
    const zip = zipStore([{ name: 'x.txt', data: 'x' }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
  });

  it('writes an empty archive that reads back empty', () => {
    expect(unzipStore(zipStore([])).size).toBe(0);
  });

  it('detects a corrupted file', () => {
    const zip = zipStore([{ name: 'x.txt', data: 'hello' }]);
    zip[30 + 5] = (zip[30 + 5] as number) ^ 0xff;
    expect(() => unzipStore(zip)).toThrow(/CRC/);
  });
});
