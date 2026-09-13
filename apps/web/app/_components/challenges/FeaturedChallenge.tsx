import { Calendar, Trophy } from 'lucide-react';
import styles from './FeaturedChallenge.module.css';

const CHALLENGE = {
  title: 'ASSOS SHIFT Territory Grand Prix',
  tag: 'Featured Challenge',
  sport: 'Ride 91km in 14 days',
  reward: 'Enter to win an onchain Commemorative Kit NFT + 15% off in-store partner gear',
  dates: '7 Sept 2026 to 20 Sept 2026',
  prizePool: '2.5 ETH + Sector Master Badge',
};

export function FeaturedChallenge() {
  return (
    <div className={styles.card}>
      <span className={styles.tag}>
        <Trophy size={13} />
        {CHALLENGE.tag}
      </span>
      <p className={styles.title}>{CHALLENGE.title}</p>
      <p className={styles.sport}>{CHALLENGE.sport}</p>
      <p className={styles.reward}>{CHALLENGE.reward}</p>
      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <Calendar size={15} />
          {CHALLENGE.dates}
        </span>
        <span className={styles.metaItem}>
          <Trophy size={15} />
          {CHALLENGE.prizePool}
        </span>
      </div>
    </div>
  );
}
