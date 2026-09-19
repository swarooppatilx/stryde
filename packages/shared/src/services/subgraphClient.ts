import { ChainOfflineError, isChainOffline } from './client';
export const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** A hung indexer used to pin every caller — the app's splash included — forever. */
const REQUEST_TIMEOUT_MS = 15_000;

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export async function querySubgraph<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (isChainOffline()) throw new ChainOfflineError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(variables ? { query, variables } : { query }),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error('Subgraph request timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
  }
  if (!body.data) {
    throw new Error('Subgraph returned no data');
  }
  return body.data;
}
