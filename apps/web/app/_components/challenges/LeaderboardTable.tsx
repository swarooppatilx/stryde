import { fetchLeaderboard, formatArea, formatKm } from '../../_lib/leaderboard';
import styles from './LeaderboardTable.module.css';

/** The current season's leaderboard, read live from Stryde's subgraph on every revalidation. */
export async function LeaderboardTable() {
  const rows = await fetchLeaderboard();

  if (rows === null) {
    return (
      <p className={styles.note}>
        The live leaderboard is unavailable right now. Try again shortly.
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className={styles.note}>No athletes on the board yet. Be the first to record a run.</p>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Athlete</th>
          <th>Distance</th>
          <th>Territory</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.rank}>
            <td className={styles.rank}>{row.rank}</td>
            <td className={styles.athlete}>
              {row.athlete}
              {row.verified ? (
                <span className={styles.verified} title="Verified human (World ID)">
                  {' '}
                  ✓
                </span>
              ) : null}
            </td>
            <td className={styles.stat}>{formatKm(row.distanceMeters)}</td>
            <td className={styles.stat}>{formatArea(row.territorySqm)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
