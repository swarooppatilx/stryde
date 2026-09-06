import { readAsStringAsync } from 'expo-file-system/legacy';
import { ENV } from '@/constants/config';

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
    response = await fetch(`${ENV.API_URL}/api/ipfs/upload`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
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

export function uploadToIpfs(
  name: string,
  content: Record<string, unknown>
): Promise<IpfsUploadResult> {
  return postUpload({ name, content });
}

export async function uploadImageToIpfs(name: string, imageUri: string): Promise<IpfsUploadResult> {
  const base64 = await readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  return postUpload({ name, imageBase64: base64, mimeType: 'image/jpeg' });
}

export function ipfsToHttpUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
