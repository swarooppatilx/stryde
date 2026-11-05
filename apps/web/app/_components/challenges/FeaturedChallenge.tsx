import { Calendar, Trophy } from 'lucide-react';
import styles from './FeaturedChallenge.module.css';

export function FeaturedChallenge() {
  return (
    <div className={styles.card}>
      <span className={styles.tag}>
        <Trophy size={13} />
        Season leaderboard
      </span>
      <p className={styles.title}>Every recorded kilometre counts</p>
      <p className={styles.sport}>
        Run, ride, walk or hike. The season ranks athletes by distance.
      </p>
      <p className={styles.reward}>
        Hold territory and earn badges to climb, and verify with World ID to show you are one human.
      </p>
      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <Calendar size={15} />
          Live from Stryde's subgraph on Sepolia
        </span>
      </div>
    </div>
  );
}
