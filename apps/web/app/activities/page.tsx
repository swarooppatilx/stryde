import { ActivityCard } from '../_components/activities/ActivityCard';
import { SiteFooter } from '../_components/home/SiteFooter';
import { SiteHeader } from '../_components/home/SiteHeader';
import { fetchRecentPosts } from '../_lib/feed';
import styles from './page.module.css';

function Feed({ posts }: { posts: Awaited<ReturnType<typeof fetchRecentPosts>> }) {
  if (posts === null) return <p>The live feed is unavailable right now. Try again shortly.</p>;
  if (posts.length === 0) return <p>No activities recorded yet.</p>;
  return (
    <div className={styles.feed}>
      {posts.map((post) => (
        <ActivityCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default async function ActivitiesPage() {
  const posts = await fetchRecentPosts();

  return (
    <main>
      <SiteHeader />
      <div className={styles.section}>
        <h1 className={styles.heading}>Activity Feed</h1>
        <Feed posts={posts} />
      </div>
      <SiteFooter />
    </main>
  );
}
