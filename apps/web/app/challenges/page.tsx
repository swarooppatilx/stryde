import { FeaturedChallenge } from '../_components/challenges/FeaturedChallenge';
import { FilterTags } from '../_components/challenges/FilterTags';
import { LeaderboardTable } from '../_components/challenges/LeaderboardTable';
import { SiteFooter } from '../_components/home/SiteFooter';
import { SiteHeader } from '../_components/home/SiteHeader';
import styles from './page.module.css';

export default function ChallengesPage() {
  return (
    <main>
      <SiteHeader />
      <div className={styles.section}>
        <h1 className={styles.heading}>Challenges</h1>
        <FeaturedChallenge />
        <FilterTags />
        <div>
          <h2 className={styles.leaderboardHeading}>Leaderboard</h2>
          <LeaderboardTable />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
