import { Crown, MessageCircle, ThumbsUp } from 'lucide-react';
import type { ActivityPost } from '../../_lib/feed';
import styles from './ActivityCard.module.css';

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
          <p className={styles.statLabel}>Pace / speed</p>
          <p className={styles.statValue}>{post.pace}</p>
        </div>
      </div>

      <div className={styles.footer}>
        {post.territoryClaimed ? (
          <span className={styles.territoryBadge}>
            <Crown size={15} />
            {post.territoryClaimed}
          </span>
        ) : (
          <span />
        )}
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
