import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';
import { uploadImageToIpfs } from '@/services/ipfsService';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

describe('uploadImageToIpfs', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ cid: 'bafy123', size: 4 }))
    );
  });

  afterEach(() => {
    uninstallFakePlatform();
    vi.unstubAllGlobals();
  });

  it('rejects a photo that is no longer on the device', async () => {
    installFakePlatform();
    await expect(uploadImageToIpfs('a', 'file:///gone.jpg')).rejects.toThrow(
      'Image file not found'
    );
  });

  it('rejects a photo over 10MB without reading it', async () => {
    const platform = installFakePlatform();
    platform.files.contents.set('file:///big.jpg', 'x'.repeat(10 * 1024 * 1024 + 1));
    const read = vi.spyOn(platform.files, 'readBase64');

    await expect(uploadImageToIpfs('a', 'file:///big.jpg')).rejects.toThrow('too large');
    expect(read).not.toHaveBeenCalled();
  });

  it('uploads the photo contents as base64', async () => {
    const platform = installFakePlatform();
    platform.files.contents.set('file:///ok.jpg', 'QUJD');

    const result = await uploadImageToIpfs('shot', 'file:///ok.jpg');

    expect(result.cid).toBe('bafy123');
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ name: 'shot', imageBase64: 'QUJD' });
  });
});
