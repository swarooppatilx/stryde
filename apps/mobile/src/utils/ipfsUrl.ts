export function ipfsToHttpUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
