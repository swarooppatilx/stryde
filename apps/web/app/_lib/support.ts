/** The support address comes from the environment so it is never baked into the source. */
export function supportEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return value ? value : null;
}
