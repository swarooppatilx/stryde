import { fetchLeaderboard, formatArea, formatKm } from '../../_lib/leaderboard';

const NOTE = 'rounded-[24px] border border-[#ebecee] bg-white p-6 text-[14px] text-[#7a828a]';

/** The current season's leaderboard, read live from Stryde's subgraph on every revalidation. */
export async function LeaderboardTable() {
  const rows = await fetchLeaderboard();

  if (rows === null) {
    return (
      <p className={NOTE}>The live leaderboard is unavailable right now. Try again shortly.</p>
    );
  }
  if (rows.length === 0) {
    return <p className={NOTE}>No athletes on the board yet. Be the first to record a run.</p>;
  }

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
            {rows.map((row) => (
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
                    <span className="text-[14px] font-semibold text-[#7a828a]">{row.rank}</span>
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
                  {formatKm(row.distanceMeters)}
                </td>
                <td className="px-6 py-4 text-[14px] font-medium text-[var(--color-brand)]">
                  {formatArea(row.territorySqm)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
