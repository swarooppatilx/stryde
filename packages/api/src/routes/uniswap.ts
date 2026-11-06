import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { encodeAbiParameters, type Hex, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { isWalletBanned } from '../lib/humanPass.js';
import { getRelayerPublicClient } from '../lib/relayer.js';

export const uniswap = new Hono();

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PASS_TTL_SEC = 300;
const PROOF_MAX_AGE_MS = 5 * 60_000;

const SEPOLIA_V4 = {
  poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
  poolSwapTest: '0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe',
  stateView: '0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C',
  quoter: '0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244',
} as const;

const TIER_LABELS: Record<number, string> = {
  1: 'Active athlete (0.05%)',
  2: 'Verified athlete (0.30%)',
  3: 'Buyer (0.30%)',
  4: 'Unverified seller (3%)',
};

const sweatFeeHookAbi = [
  {
    type: 'function',
    name: 'getFeeFor',
    stateMutability: 'view',
    inputs: [
      { name: 'athlete', type: 'address' },
      { name: 'isSell', type: 'bool' },
    ],
    outputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'fee', type: 'uint24' },
    ],
  },
  {
    type: 'function',
    name: 'isActive',
    stateMutability: 'view',
    inputs: [{ name: 'athlete', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function hookAddress(): `0x${string}` | null {
  const value = process.env.SWEAT_FEE_HOOK_ADDRESS;
  return value && HEX_ADDRESS_RE.test(value) ? (value as `0x${string}`) : null;
}

function poolKey(hook: `0x${string}`) {
  return {
    currency0: '0x0000000000000000000000000000000000000000',
    currency1: getRelayChainConfig().contracts.moveToEarnToken!,
    fee: 0x800000,
    tickSpacing: 60,
    hooks: hook,
  };
}

export function feePassProofMessage(wallet: string, issuedAt: number): string {
  return `Stryde fee pass\nwallet:${wallet.toLowerCase()}\nissued:${issuedAt}`;
}

uniswap.use('*', async (c, next) => {
  if (!hookAddress())
    return c.json({ error: 'SweatFeeHook is not configured on this server' }, 503);
  await next();
});

uniswap.get('/info', (c) => {
  const hook = hookAddress()!;
  return c.json({
    chainId: getRelayChainConfig().chainId,
    hook,
    poolKey: poolKey(hook),
    router: SEPOLIA_V4.poolSwapTest,
    poolManager: SEPOLIA_V4.poolManager,
    stateView: SEPOLIA_V4.stateView,
    quoter: SEPOLIA_V4.quoter,
    tiers: TIER_LABELS,
  });
});

uniswap.get('/fee', async (c) => {
  const wallet = c.req.query('wallet') ?? '';
  if (!HEX_ADDRESS_RE.test(wallet)) return c.json({ error: 'wallet required' }, 400);
  const client = getRelayerPublicClient();
  const hook = hookAddress()!;
  const [withPass, withoutPass, active] = await Promise.all([
    client.readContract({
      address: hook,
      abi: sweatFeeHookAbi,
      functionName: 'getFeeFor',
      args: [wallet as Hex, true],
    }),
    client.readContract({
      address: hook,
      abi: sweatFeeHookAbi,
      functionName: 'getFeeFor',
      args: ['0x0000000000000000000000000000000000000000', true],
    }),
    client.readContract({
      address: hook,
      abi: sweatFeeHookAbi,
      functionName: 'isActive',
      args: [wallet as Hex],
    }),
  ]);
  return c.json({
    wallet,
    active,
    sell: { tier: withPass[0], feePips: withPass[1], label: TIER_LABELS[withPass[0]] },
    unverifiedSell: {
      tier: withoutPass[0],
      feePips: withoutPass[1],
      label: TIER_LABELS[withoutPass[0]],
    },
  });
});

/**
 * Issues a single-use SweatPass the athlete puts in hookData. The caller proves
 * wallet ownership with a signature (ERC-1271/6492 aware, so Privy smart
 * wallets work before deployment) — otherwise anyone could borrow a verified
 * athlete's fee tier.
 */
uniswap.post('/fee-pass', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    wallet?: string;
    issuedAt?: number;
    signature?: string;
  } | null;
  if (!body?.wallet || !HEX_ADDRESS_RE.test(body.wallet))
    return c.json({ error: 'wallet required' }, 400);
  if (
    typeof body.issuedAt !== 'number' ||
    Math.abs(Date.now() - body.issuedAt) > PROOF_MAX_AGE_MS
  ) {
    return c.json({ error: 'issuedAt must be within 5 minutes of now' }, 400);
  }
  if (!body.signature?.startsWith('0x')) return c.json({ error: 'signature required' }, 400);

  const wallet = body.wallet as `0x${string}`;
  if (isWalletBanned(wallet))
    return c.json({ error: 'This athlete is suspended from Stryde.' }, 403);

  const client = getRelayerPublicClient();
  const valid = await client
    .verifyMessage({
      address: wallet,
      message: feePassProofMessage(wallet, body.issuedAt),
      signature: body.signature as Hex,
    })
    .catch(() => false);
  if (!valid) return c.json({ error: 'Wallet signature is invalid' }, 401);

  const signerKey = (process.env.SWEAT_PASS_SIGNER_KEY || process.env.RELAYER_PRIVATE_KEY) as
    | Hex
    | undefined;
  if (!signerKey) return c.json({ error: 'Service misconfigured' }, 503);
  const signer = privateKeyToAccount(signerKey);

  const hook = hookAddress()!;
  const router = SEPOLIA_V4.poolSwapTest;
  const chainId = BigInt(getRelayChainConfig().chainId);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + PASS_TTL_SEC);
  const nonce = `0x${randomBytes(32).toString('hex')}` as Hex;

  const digest = keccak256(
    encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [chainId, hook, wallet, router, deadline, nonce]
    )
  );
  const signature = await signer.signMessage({ message: { raw: digest } });
  const hookData = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'athlete', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    [{ athlete: wallet, deadline, nonce, signature }]
  );

  return c.json({
    hookData,
    deadline: Number(deadline),
    nonce,
    router,
    poolKey: poolKey(hook),
  });
});
