import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Surfaces the owner has said must stay on screen. Vitest has no React Native runtime here, so
 * these read the real component files and check each surface is still wired in. They exist because
 * a copy cleanup once removed the wallet address and STRD balance from the profile without anyone
 * noticing: the only test then enforced their absence. Each entry names the decision behind it,
 * and changing one needs the owner's say-so, not a cleanup.
 */
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('the wallet and token stay visible', () => {
  const profile = source('app/(tabs)/profile.tsx');
  const summary = source('components/profile-summary.tsx');
  const chip = source('components/wallet-chip.tsx');
  const account = source('app/account.tsx');

  it('the profile shows the wallet chip and the STRD pill', () => {
    expect(profile).toContain('<WalletPills');
    expect(profile).toContain('strdWei={balances.strd}');
    expect(summary).toContain('<WalletChip');
    expect(summary).toContain("formatTokenAmount(strdWei, 'STRD')");
  });

  it('the wallet chip names the account and copies the full address on a tap', () => {
    expect(chip).toContain('walletLabel(');
    expect(chip).toContain('clipboard.copyText(address)');
    expect(chip).toContain('Copy wallet address');
  });

  it('Settings > Account has a copyable address and both balances', () => {
    expect(account).toContain('Wallet address');
    expect(account).toContain('clipboard.copyText(address)');
    expect(account).toContain('STRD balance');
    expect(account).toContain('Challenge funds');
  });

  it('balances are read through the balance source, so the Sandbox can supply its own', () => {
    expect(source('hooks/useBalances.ts')).toContain('readBalances(');
    expect(source('backends/configure.ts')).toContain('setBalanceReader(');
  });
});

describe('other owner-decided surfaces', () => {
  it('the profile keeps the QR and share entry points', () => {
    const profile = source('app/(tabs)/profile.tsx');
    expect(profile).toContain('onShowQr');
    expect(profile).toContain('buildProfileDeepLink');
  });

  it('a verified activity links to its receipt', () => {
    expect(source('app/activities/[id].tsx')).toContain('explorerTxUrl');
  });
});
