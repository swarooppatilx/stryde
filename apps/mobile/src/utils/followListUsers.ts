import type { SocialUser } from '@/utils/socialSelectors';

/** The athletes behind a list of wallets: registered ones only, each once, in list order. */
export function followListUsers(
  addresses: readonly string[],
  resolve: (id: string) => SocialUser | undefined
): SocialUser[] {
  const seen = new Set<string>();
  const users: SocialUser[] = [];
  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const user = resolve(address);
    if (user) users.push(user);
  }
  return users;
}
