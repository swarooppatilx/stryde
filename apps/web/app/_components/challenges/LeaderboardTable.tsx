import styles from './LeaderboardTable.module.css';

const ROWS = [
  { rank: 1, athlete: 'Sarah Chen', distance: '212.4 km', territory: '1.4 km²' },
  { rank: 2, athlete: 'Fernando Rayra', distance: '198.1 km', territory: '1.1 km²' },
  { rank: 3, athlete: 'Priya Sharma', distance: '176.5 km', territory: '0.9 km²' },
  { rank: 4, athlete: 'Marcus Webb', distance: '154.2 km', territory: '0.7 km²' },
];

export function LeaderboardTable() {
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
        {ROWS.map((row) => (
          <tr key={row.rank}>
            <td className={styles.rank}>{row.rank}</td>
            <td className={styles.athlete}>{row.athlete}</td>
            <td className={styles.stat}>{row.distance}</td>
            <td className={styles.stat}>{row.territory}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
