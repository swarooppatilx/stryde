/**
 * Keeps every copy of the Sepolia deployment in step with what forge actually deployed.
 *
 * After a redeploy (`packages/contracts/scripts/deploy-all.sh`), the newest contract addresses and the
 * deploy block live in forge's broadcast files, but the app, the relayer and the subgraph each carry their
 * own copy. This reads the broadcast files and rewrites those copies:
 *
 *   node packages/shared/scripts/sync-deployment.mjs          # check: lists what is out of date, exit 1 if any
 *   node packages/shared/scripts/sync-deployment.mjs --write  # update the files
 *
 * Not touched, because they need a human step: the subgraph URL (a new Studio version must be deployed
 * first; bump it in shared's constants, the API config and apps/web/app/_lib/subgraph.ts together) and
 * the generated ABIs (`yarn workspace @repo/shared generate:abis`).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getAddress } from 'viem';

const SEPOLIA_CHAIN_ID = 11155111;

const camel = (name) => name[0].toLowerCase() + name.slice(1);
const underscored = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '_');

/** The contracts a broadcast file created, with the block each landed in. Plain calls are ignored. */
export function parseBroadcast(broadcast) {
  return (broadcast.transactions ?? [])
    .filter((tx) => tx.transactionType === 'CREATE' && tx.contractName && tx.contractAddress)
    .map((tx) => {
      const receipt = (broadcast.receipts ?? []).find((r) => r.transactionHash === tx.hash);
      return {
        name: tx.contractName,
        address: tx.contractAddress,
        block: receipt ? Number.parseInt(receipt.blockNumber, 16) : 0,
        timestamp: broadcast.timestamp ?? 0,
      };
    });
}

/**
 * The newest deployment of each contract. The deploy block is the earliest block among those: stale
 * deployments of a contract that has since been redeployed must not pull it back.
 */
export function pickLatest(entries) {
  const latest = new Map();
  for (const entry of entries) {
    const known = latest.get(entry.name);
    if (!known || entry.timestamp > known.timestamp) latest.set(entry.name, entry);
  }
  const chosen = [...latest.values()];
  return {
    contracts: Object.fromEntries(chosen.map((e) => [camel(e.name), e.address])),
    deployBlock: Math.min(...chosen.map((e) => e.block)),
  };
}

export function collectDeployment(broadcastDir, chainId = SEPOLIA_CHAIN_ID) {
  const entries = [];
  for (const dir of readdirSync(broadcastDir)) {
    try {
      const file = join(broadcastDir, dir, String(chainId), 'run-latest.json');
      entries.push(...parseBroadcast(JSON.parse(readFileSync(file, 'utf8'))));
    } catch {
      // A script that never ran on this chain has no file here.
    }
  }
  const { contracts, deployBlock } = pickLatest(entries);
  return {
    contracts: Object.fromEntries(Object.entries(contracts).map(([k, a]) => [k, getAddress(a)])),
    deployBlock,
  };
}

const swapAddresses = (region, contracts) =>
  Object.entries(contracts).reduce(
    (text, [key, address]) =>
      text.replace(new RegExp(`(\\b${key}: ')0x[0-9a-fA-F]{40}(')`), `$1${address}$2`),
    region
  );

/** shared's `constants.ts`: only the `ethereum-sepolia` entry. */
export function rewriteConstants(source, contracts, deployBlock) {
  const start = source.indexOf("'ethereum-sepolia': {");
  if (start === -1) throw new Error("No 'ethereum-sepolia' entry in constants.ts");
  const next = source.indexOf("\n  '", start + 10);
  const end = next === -1 ? source.length : next;
  const region = swapAddresses(source.slice(start, end), contracts).replace(
    /deployBlock: \d+n/,
    `deployBlock: ${deployBlock}n`
  );
  return source.slice(0, start) + region + source.slice(end);
}

/** The API relayer's own copy: the Sepolia table and the Sepolia entry's deploy block. */
export function rewriteApiConfig(source, contracts, deployBlock) {
  const start = source.indexOf('export const SEPOLIA_CONTRACTS');
  if (start === -1) throw new Error('No SEPOLIA_CONTRACTS in chainConfig.ts');
  const end = source.indexOf('};', start);
  let out =
    source.slice(0, start) + swapAddresses(source.slice(start, end), contracts) + source.slice(end);
  const entry = out.indexOf('11155111: {');
  if (entry === -1) throw new Error('No 11155111 entry in chainConfig.ts');
  out =
    out.slice(0, entry) +
    out.slice(entry).replace(/deployBlock: [\d_]+n/, `deployBlock: ${underscored(deployBlock)}n`);
  return out;
}

/** The subgraph manifest: each source's address and start block. */
export function rewriteManifest(yaml, contracts, deployBlock) {
  // The exact shape of a data source, so an `abis:` entry that repeats a contract's name is never mistaken for one.
  return yaml.replace(
    /(\n {4}name: (\w+)\n {4}network: \w+\n {4}source:\n {6}address: ")(0x[0-9a-fA-F]{40})("\n {6}abi: \w+\n {6}startBlock: )(\d+)/g,
    (whole, head, name, _address, mid) => {
      const next = contracts[camel(name)];
      return next ? `${head}${next}${mid}${deployBlock}` : whole;
    }
  );
}

export const TARGETS = [
  { file: 'packages/shared/src/constants.ts', rewrite: rewriteConstants },
  { file: 'packages/api/src/lib/chainConfig.ts', rewrite: rewriteApiConfig },
  { file: 'packages/subgraph/subgraph.yaml', rewrite: rewriteManifest },
];

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const write = process.argv.includes('--write');
  const { contracts, deployBlock } = collectDeployment(join(root, 'packages/contracts/broadcast'));
  console.log(
    `Latest Sepolia deployment: ${Object.keys(contracts).length} contracts, deploy block ${deployBlock}`
  );

  let stale = 0;
  for (const { file, rewrite } of TARGETS) {
    const path = join(root, file);
    const before = readFileSync(path, 'utf8');
    const after = rewrite(before, contracts, deployBlock);
    if (after === before) {
      console.log(`  in sync   ${file}`);
      continue;
    }
    stale++;
    if (write) writeFileSync(path, after);
    console.log(`  ${write ? 'updated  ' : 'OUT OF DATE'} ${file}`);
  }
  if (stale && !write) {
    console.log('\nRun again with --write to update them.');
    process.exit(1);
  }
  if (write && stale)
    console.log('\nNow bump the subgraph URL by hand after deploying the new subgraph version.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
