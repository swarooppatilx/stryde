/** "1 activity", "0 activities": a count with the right noun form. */
export const countOf = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** 1 as "1st", 2 as "2nd", 11 as "11th". */
export const ordinal = (n: number) => {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};
