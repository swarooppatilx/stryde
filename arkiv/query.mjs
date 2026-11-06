// Reads Stryde's Arkiv entities on Rabdi (chain 7794095). No wallet needed.
// Run from the repo root after `yarn install`: node arkiv/query.mjs [athleteWallet]
import { createPublicClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { eq, startsWith } from '@arkiv-network/sdk/query';
import { addr, bool, bytes, dec, defineSchema, i32, str, u64 } from '@arkiv-network/sdk/schema';
import { http } from 'viem';

// Same definitions as packages/api/src/lib/arkivFitness.ts.
const Segments = defineSchema('stryde_segment', {
  name: str(),
  sportType: i32().indexed(),
  geohash: str().indexed(),
  startLat: dec(),
  startLng: dec(),
  endLat: dec(),
  endLng: dec(),
  distanceM: u64().indexed(),
  creator: addr().indexed(),
});
const RouteArchives = defineSchema('stryde_route_archive', {
  athlete: addr().indexed(),
  activityId: u64().indexed(),
  recordedAt: u64().indexed(),
  swarmRef: str().optional(),
  sealedRef: bytes().optional(),
  encrypted: bool().indexed(),
  distanceM: u64(),
  pointCount: u64(),
  contentType: str(),
});

const WRITER = '0x47d877a30be79E3b1b0926943d675CD22f4B914a';
const athlete = process.argv[2] ?? '0x0480322cd1111439439d70D25dD2a304001d97eD';
// An empty key uses the rate-limited public endpoint; set ARKIV_ACCESS_KEY for your own.
const client = createPublicClient({
  chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' }),
  transport: http(),
});
const value = (entity, name) => entity[name]?.value;

// Segments whose start gate is in Mumbai (geohash prefix "te7u"), attested by Stryde.
const segments = await client
  .select()
  .from(Segments)
  .where(startsWith('geohash', 'te7u'))
  .createdBy(WRITER)
  .limit(20)
  .fetch();
console.log(`stryde_segment near te7u: ${segments.entities.length}`);
for (const s of segments.entities) {
  console.log(`  ${s.$key}  ${value(s, 'name')}  ${value(s, 'distanceM')} m  owner ${s.$owner}`);
}

// One athlete's run archives; public ones point at a GPX on Swarm.
const archives = await client
  .select()
  .from(RouteArchives)
  .where(eq('athlete', addr(athlete)))
  .createdBy(WRITER)
  .limit(20)
  .fetch();
console.log(`stryde_route_archive for ${athlete}: ${archives.entities.length}`);
for (const a of archives.entities) {
  const ref = value(a, 'swarmRef');
  console.log(
    `  ${a.$key}  ${value(a, 'encrypted') ? 'private (sealed ref)' : `https://api.gateway.ethswarm.org/bzz/${ref}/`}`
  );
}
