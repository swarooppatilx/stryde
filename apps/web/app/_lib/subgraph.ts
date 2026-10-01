// Stryde's Sepolia subgraph. Keep in step with `subgraphUrl` in packages/shared/src/constants.ts
// (a test fails if they drift): bump both when a new version is deployed.
export const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1760059/stryde/v0.6.0';
const REVALIDATE_SECONDS = 60;

export const subgraphUrl = () => SUBGRAPH_URL;

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** One GraphQL request, cached for a minute by Next; throws on any failure. */
export async function querySubgraph<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`Subgraph request failed: ${response.status}`);
  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!json.data) throw new Error(json.errors?.[0]?.message ?? 'Subgraph returned no data');
  return json.data;
}
