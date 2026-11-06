import { ActivityCard } from '../_components/activities/activity-card';
import { SiteFooter } from '../_components/layout/site-footer';
import { SiteHeader } from '../_components/layout/site-header';
import { fetchRecentPosts } from '../_lib/feed';

const NOTE = 'rounded-[24px] border border-[#ebecee] bg-white p-6 text-[14px] text-[#7a828a]';

function Feed({ posts }: { posts: Awaited<ReturnType<typeof fetchRecentPosts>> }) {
  if (posts === null) {
    return <p className={NOTE}>The live feed is unavailable right now. Try again shortly.</p>;
  }
  if (posts.length === 0) return <p className={NOTE}>No activities recorded yet.</p>;
  return (
    <div className="flex flex-col gap-6">
      {posts.map((post) => (
        <ActivityCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default async function ActivitiesPage() {
  const posts = await fetchRecentPosts();

  return (
    <div className="min-h-screen bg-[#faf9f8] mt-5">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-6 pb-24 pt-12">
        <div className="mb-8">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
            Feed
          </span>
          <h1 className="mt-1 text-[36px] font-normal tracking-tight text-[#0b0e14]">
            Community activities
          </h1>
        </div>
        <Feed posts={posts} />
      </main>
      <SiteFooter />
    </div>
  );
}
