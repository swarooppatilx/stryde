const NAMED: Readonly<Record<number, string>> = {
  1609: '1 mile',
  21097: 'Half marathon',
  42195: 'Marathon',
};

/** How a best-effort distance is written: "400 m", "5 km", "Half marathon". */
export function effortLabel(distance: number): string {
  const named = NAMED[distance];
  if (named) return named;
  return distance < 1000 ? `${distance} m` : `${distance / 1000} km`;
}
