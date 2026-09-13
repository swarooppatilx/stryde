import { ActivityCard, type ActivityPost } from '../_components/activities/ActivityCard';
import { SiteFooter } from '../_components/home/SiteFooter';
import { SiteHeader } from '../_components/home/SiteHeader';
import styles from './page.module.css';

const SEEDED_FEED: ActivityPost[] = [
  {
    id: 'post-1',
    athleteName: 'Sarah Chen',
    athleteInitials: 'SC',
    timeAgo: '2h ago',
    title: 'Morning Tempo Run',
    note: 'Around 4:45/km. Felt great! Closed the loop near the canal park.',
    distance: '8.20 km',
    duration: '38m 12s',
    pace: '4:39 /km',
    elevation: '+124m',
    territoryClaimed: '+34,800 m² Claimed',
    kudosCount: 14,
    commentsCount: 3,
  },
  {
    id: 'post-2',
    athleteName: 'Fernando Rayra',
    athleteInitials: 'FR',
    timeAgo: '5h ago',
    title: 'Campanha Ridge Climb',
    note: 'Long ride out to the ridge and back. Legs are cooked, worth it for the view.',
    distance: '24.60 km',
    duration: '1h 04m',
    pace: '23.1 km/h',
    elevation: '+480m',
    territoryClaimed: '+61,200 m² Claimed',
    kudosCount: 22,
    commentsCount: 6,
  },
];

export default function ActivitiesPage() {
  return (
    <main>
      <SiteHeader />
      <div className={styles.section}>
        <h1 className={styles.heading}>Activity Feed</h1>
        <div className={styles.feed}>
          {SEEDED_FEED.map((post) => (
            <ActivityCard key={post.id} post={post} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
