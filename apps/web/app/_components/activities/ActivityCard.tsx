import { Crown, MessageCircle, ThumbsUp } from 'lucide-react';
import styles from './ActivityCard.module.css';

export type ActivityPost = {
  id: string;
  athleteName: string;
  athleteInitials: string;
  timeAgo: string;
  title: string;
  note: string;
  distance: string;
  duration: string;
  pace: string;
  elevation: string;
  territoryClaimed: string;
  kudosCount: number;
  commentsCount: number;
};

export function ActivityCard({ post }: { post: ActivityPost }) {
  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.avatar}>{post.athleteInitials}</div>
        <div>
          <p className={styles.athleteName}>{post.athleteName}</p>
          <p className={styles.meta}>{post.timeAgo}</p>
        </div>
      </div>

      <div>
        <p className={styles.title}>{post.title}</p>
        <p className={styles.note}>{post.note}</p>
      </div>

      <div className={styles.stats}>
        <div>
          <p className={styles.statLabel}>Distance</p>
          <p className={styles.statValue}>{post.distance}</p>
        </div>
        <div>
          <p className={styles.statLabel}>Duration</p>
          <p className={styles.statValue}>{post.duration}</p>
        </div>
        <div>
          <p className={styles.statLabel}>Pace</p>
          <p className={styles.statValue}>{post.pace}</p>
        </div>
        <div>
          <p className={styles.statLabel}>Elevation</p>
          <p className={styles.statValue}>{post.elevation}</p>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.territoryBadge}>
          <Crown size={15} />
          {post.territoryClaimed}
        </span>
        <div className={styles.engagement}>
          <span className={styles.engagementItem}>
            <ThumbsUp size={15} />
            {post.kudosCount}
          </span>
          <span className={styles.engagementItem}>
            <MessageCircle size={15} />
            {post.commentsCount}
          </span>
        </div>
      </div>
    </article>
  );
}
