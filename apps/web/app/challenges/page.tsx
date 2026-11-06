import { FeaturedChallenge } from "../_components/challenges/featured-challenge";
import { FilterTags } from "../_components/challenges/filter-tags";
import { LeaderboardTable } from "../_components/challenges/leaderboard-table";
import { SiteFooter } from "../_components/layout/site-footer";
import { SiteHeader } from "../_components/layout/site-header";

export default function ChallengesPage() {
  return (
    <div className="min-h-screen bg-[#faf9f8]">
      <SiteHeader />
      <main className="mx-auto flex max-w-[880px] flex-col gap-10 px-6 pb-24 pt-12">
        <div>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
            Competitions
          </span>
          <h1 className="mt-1 text-[36px] font-normal tracking-tight text-[#0b0e14]">
            Challenges and leaderboards
          </h1>
        </div>

        <FeaturedChallenge />
        <FilterTags />

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-[20px] font-medium tracking-tight text-[#0b0e14]">
              Global Sector Standings
            </h2>
            <span className="text-[13px] text-[#7a828a]">Season 1</span>
          </div>
          <LeaderboardTable />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
