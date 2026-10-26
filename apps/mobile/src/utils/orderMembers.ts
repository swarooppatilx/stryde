/** A club's members as lower-case wallets, each once, with the owner first. */
export function orderMembers(members: readonly string[], owner: string): string[] {
  const ownerKey = owner.toLowerCase();
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const member of members) {
    const key = member.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  const ownerAt = ordered.indexOf(ownerKey);
  if (ownerAt > 0) ordered.unshift(...ordered.splice(ownerAt, 1));
  return ordered;
}
