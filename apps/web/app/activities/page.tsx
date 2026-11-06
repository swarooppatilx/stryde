import {
  ActivityCard,
  type ActivityPost,
} from "../_components/activities/activity-card";
import { SiteFooter } from "../_components/layout/site-footer";
import { SiteHeader } from "../_components/layout/site-header";

const SEEDED_FEED: ActivityPost[] = [
  {
    id: "post-1",
    athleteName: "Sarah Chen",
    athleteInitials: "SC",
    timeAgo: "2h ago",
    title: "Morning Tempo Run",
    note: "Paced at 4:39/km. Enclosed the canal park loop and claimed sector 14.",
    distance: "8.20 km",
    duration: "38m 12s",
    pace: "4:39 /km",
    elevation: "+124m",
    territoryClaimed: "+34,800 m²",
    kudosCount: 14,
    commentsCount: 3,
  },
  {
    id: "post-2",
    athleteName: "Fernando Rayra",
    athleteInitials: "FR",
    timeAgo: "5h ago",
    title: "Campanha Ridge Climb",
    note: "Long perimeter ride out to the ridge. Sector boundary expanded across the valley.",
    distance: "24.60 km",
    duration: "1h 04m",
    pace: "23.1 km/h",
    elevation: "+480m",
    territoryClaimed: "+61,200 m²",
    kudosCount: 22,
    commentsCount: 6,
  },
];

export default function ActivitiesPage() {
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

        <div className="flex flex-col gap-6">
          {SEEDED_FEED.map((post) => (
            <ActivityCard key={post.id} post={post} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
