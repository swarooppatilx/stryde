const ROWS = [
  {
    rank: 1,
    athlete: "Sarah Chen",
    distance: "212.4 km",
    territory: "1.40 km²",
    verified: true,
  },
  {
    rank: 2,
    athlete: "Fernando Rayra",
    distance: "198.1 km",
    territory: "1.10 km²",
    verified: true,
  },
  {
    rank: 3,
    athlete: "Priya Sharma",
    distance: "176.5 km",
    territory: "0.90 km²",
    verified: true,
  },
  {
    rank: 4,
    athlete: "Marcus Webb",
    distance: "154.2 km",
    territory: "0.70 km²",
    verified: false,
  },
];

export function LeaderboardTable() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#ebecee] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#ebecee] bg-[#faf9f8]">
              <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
                Rank
              </th>
              <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
                Athlete
              </th>
              <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
                Distance
              </th>
              <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
                Territory Claimed
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.rank}
                className="border-b border-[#ebecee] last:border-none transition-colors hover:bg-[#faf9f8]"
              >
                <td className="px-6 py-4 text-[14px]">
                  {row.rank === 1 ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-[12px] font-semibold text-white">
                      1
                    </span>
                  ) : (
                    <span className="text-[14px] font-semibold text-[#7a828a]">
                      {row.rank}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-[14px] font-medium text-[#0b0e14]">
                  <div className="flex items-center gap-2">
                    <span>{row.athlete}</span>
                    {row.verified && (
                      <span className="rounded-full bg-[#faf9f8] border border-[#ebecee] px-2 py-0.5 text-[11px] text-[#7a828a]">
                        World ID
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-[14px] text-[#7a828a]">
                  {row.distance}
                </td>
                <td className="px-6 py-4 text-[14px] font-medium text-[var(--color-brand)]">
                  {row.territory}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
