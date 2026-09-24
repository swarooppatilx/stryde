/**
 * Read-only demo-day preflight: the runbook's "is everything alive?" checks in one command.
 *
 *   API_URL=https://<deployed-api> RELAYER_ADDRESS=0x... API_KEY=... \
 *     node --import tsx packages/shared/scripts/demo-preflight.mjs
 *
 * Optional: SUBGRAPH_URL, RPC_URL, MIN_RELAYER_ETH (0.2), MAX_LAG_BLOCKS (50), CHAIN_MODE.
 * Exits 1 if any check fails. It only reads; it never writes onchain or to the API.
 */
import { pathToFileURL } from 'node:url';

const TIMEOUT_MS = 10_000;

export function lagVerdict({ subgraphBlock, chainBlock, maxLag, hasIndexingErrors = false }) {
  if (hasIndexingErrors) {
    return { ok: false, detail: 'subgraph reports indexing errors' };
  }
  const lag = chainBlock - subgraphBlock;
  return lag > maxLag
    ? { ok: false, detail: `${lag} blocks behind the chain (limit ${maxLag})` }
    : { ok: true, detail: `${Math.max(lag, 0)} blocks behind` };
}

export function followVerdict({ status }) {
  if (status === 200) return { ok: true, detail: 'answers' };
  if (status === 401) return { ok: false, detail: 'HTTP 401: set API_KEY to the app key' };
  return {
    ok: false,
    detail: `HTTP ${status}: are ARKIV_ACCESS_KEY / ARKIV_PRIVATE_KEY set on the deployed API?`,
  };
}

export function balanceVerdict({ wei, minEth }) {
  const eth = Number(wei) / 1e18;
  const shown = eth.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return eth >= minEth
    ? { ok: true, detail: `${shown} ETH` }
    : { ok: false, detail: `${shown} ETH, need at least ${minEth}` };
}

export function healthVerdict({ status, body }) {
  return status === 200 && body?.status === 'ok'
    ? { ok: true, detail: 'ok' }
    : { ok: false, detail: `HTTP ${status}, status ${body?.status ?? 'unknown'}` };
}

export function parseArgs(env) {
  if (!env.API_URL)
    throw new Error('Set API_URL to the deployed API, e.g. https://stryde-api.vercel.app');
  if (!env.RELAYER_ADDRESS) throw new Error('Set RELAYER_ADDRESS to the relayer wallet address');
  return {
    apiUrl: env.API_URL.replace(/\/+$/, ''),
    apiKey: env.API_KEY ?? '',
    relayerAddress: env.RELAYER_ADDRESS,
    subgraphUrl: env.SUBGRAPH_URL ?? '',
    rpcUrl: env.RPC_URL ?? '',
    minRelayerEth: Number(env.MIN_RELAYER_ETH ?? 0.2),
    maxLagBlocks: Number(env.MAX_LAG_BLOCKS ?? 50),
    chainMode: env.CHAIN_MODE ?? 'ethereum-sepolia',
  };
}

export function formatReport(results) {
  const width = Math.max(...results.map((r) => r.name.length));
  const lines = results.map(
    (r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`
  );
  const ok = results.every((r) => r.ok);
  lines.push('', ok ? 'All checks passed.' : 'Some checks FAILED: fix them before the demo.');
  return { ok, text: lines.join('\n') };
}

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function rpc(rpcUrl, method, params) {
  const { body } = await getJson(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!body || body.error) throw new Error(body?.error?.message ?? `${method} failed`);
  return body.result;
}

/** Runs one check, turning a throw into a failed result so the rest still run. */
async function check(name, run) {
  try {
    return { name, ...(await run()) };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const config = parseArgs(process.env);
  const { getChainConfig } = await import('../src/constants.ts');
  const chain = getChainConfig(config.chainMode);
  const rpcUrl = config.rpcUrl || chain.rpcUrl;
  const subgraphUrl = config.subgraphUrl || chain.subgraphUrl;
  const apiHeaders = config.apiKey ? { 'X-API-Key': config.apiKey } : {};

  const results = [
    await check('API health', async () =>
      healthVerdict(await getJson(`${config.apiUrl}/api/health`))
    ),
    await check('Follow graph (Arkiv)', async () => {
      // Any address works: a 200 means the API answered from its follow store.
      return followVerdict(
        await getJson(`${config.apiUrl}/api/social/following/${config.relayerAddress}`, {
          headers: apiHeaders,
        })
      );
    }),
    await check('Relayer balance', async () =>
      balanceVerdict({
        wei: BigInt(await rpc(rpcUrl, 'eth_getBalance', [config.relayerAddress, 'latest'])),
        minEth: config.minRelayerEth,
      })
    ),
    await check('Subgraph freshness', async () => {
      if (!subgraphUrl) return { ok: false, detail: 'no subgraph URL for this chain' };
      const { body } = await getJson(subgraphUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ _meta { hasIndexingErrors block { number } } }' }),
      });
      const meta = body?.data?._meta;
      if (!meta) return { ok: false, detail: 'no _meta in the subgraph response' };
      return lagVerdict({
        subgraphBlock: meta.block.number,
        chainBlock: Number(BigInt(await rpc(rpcUrl, 'eth_blockNumber', []))),
        maxLag: config.maxLagBlocks,
        hasIndexingErrors: meta.hasIndexingErrors,
      });
    }),
  ];

  for (const [name, address] of Object.entries(chain.contracts)) {
    results.push(
      await check(`Contract ${name}`, async () => {
        const code = await rpc(rpcUrl, 'eth_getCode', [address, 'latest']);
        return code && code !== '0x'
          ? { ok: true, detail: address }
          : { ok: false, detail: `no code at ${address}` };
      })
    );
  }

  const report = formatReport(results);
  console.log(report.text);
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
