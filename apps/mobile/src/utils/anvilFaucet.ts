import { getLocalRpcUrl } from '@/constants/config';

const ANVIL_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const DEFAULT_BALANCE = '0x56BC75E2D63100000'; // 100 ETH in hex

export type FaucetResult = 'funded' | 'already-funded' | 'failed';

export async function ensureLocalWalletFunded(): Promise<FaucetResult> {
  const rpcUrl = getLocalRpcUrl();
  try {
    const balanceRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [ANVIL_ACCOUNT, 'latest'],
      }),
    });

    const { result: balanceHex } = await balanceRes.json();
    const balance = BigInt(balanceHex);

    if (balance >= 10000000000000000000n) {
      return 'already-funded';
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'anvil_setBalance',
        params: [ANVIL_ACCOUNT, DEFAULT_BALANCE],
      }),
    });

    const result = await response.json();
    if (result.error) {
      console.warn('[Anvil] Failed to fund wallet:', result.error);
      return 'failed';
    }

    if (__DEV__) console.log('[Anvil] Wallet funded with 100 ETH');
    return 'funded';
  } catch (error) {
    console.warn('[Anvil] Could not fund wallet:', error);
    return 'failed';
  }
}
