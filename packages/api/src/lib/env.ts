/** True on any production deployment: the host may set either variable. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}
