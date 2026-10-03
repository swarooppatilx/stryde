import { services } from '@repo/shared';
import { ENV } from '@/constants/config';
import { getPlatform } from '@/platform';

interface IpfsUploadResult {
  cid: string;
  size: number;
}

const API_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(ENV.API_KEY ? { 'X-API-Key': ENV.API_KEY } : {}),
};

const UPLOAD_TIMEOUT_MS = 30_000;

async function postUpload(body: Record<string, unknown>): Promise<IpfsUploadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    // The profile in force may answer the API on the device (Sandbox), which the shared config carries.
    response = await (services.ipfs.getIpfsConfig()?.fetch ?? fetch)(
      `${ENV.API_URL}/api/ipfs/upload`,
      {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
  } catch (err) {
    if (controller.signal.aborted) throw new Error('IPFS upload timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }

  const result = (await response.json()) as Partial<IpfsUploadResult>;
  if (typeof result.cid !== 'string' || result.cid.length === 0) {
    throw new Error('IPFS upload returned no cid');
  }
  return { cid: result.cid, size: result.size ?? 0 };
}

export async function uploadImageToIpfs(name: string, imageUri: string): Promise<IpfsUploadResult> {
  const { files } = getPlatform();
  const fileSize = await files.size(imageUri);
  if (fileSize === null) {
    throw new Error('Image file not found');
  }
  if (fileSize > 10 * 1024 * 1024) {
    throw new Error('Image too large — maximum 10MB');
  }

  const base64 = await files.readBase64(imageUri);

  return postUpload({ name, imageBase64: base64, mimeType: 'image/jpeg' });
}

import { ipfsToHttpUrl } from '@/utils/ipfsUrl';

export { ipfsToHttpUrl };

/** Uploads a photo to IPFS and resolves to its public link. */
export const ipfsPhotoUploader = {
  upload: async (name: string, uri: string): Promise<string> =>
    ipfsToHttpUrl((await uploadImageToIpfs(name, uri)).cid),
};
