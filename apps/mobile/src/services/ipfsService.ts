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

export async function uploadToIpfs(
  name: string,
  content: Record<string, unknown>
): Promise<IpfsUploadResult> {
  const response = await fetch(`${ENV.API_URL}/api/ipfs/upload`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ name, content }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }

  return response.json();
}

export async function uploadImageToIpfs(name: string, imageUri: string): Promise<IpfsUploadResult> {
  const base64 = await readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const response = await fetch(`${ENV.API_URL}/api/ipfs/upload`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({
      name,
      imageBase64: base64,
      mimeType: 'image/jpeg',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS image upload failed: ${error}`);
  }

  return response.json();
}

export function ipfsToHttpUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
