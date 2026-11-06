import { FeatureScrollStory } from "./_components/landing/feature-scroll-story";
import { Hero } from "./_components/landing/hero";
import { TerritoryBanner } from "./_components/landing/territory-banner";
import { SiteFooter } from "./_components/layout/site-footer";
import { SiteHeader } from "./_components/layout/site-header";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#faf9f8]">
      <SiteHeader />
      <main className="pt-14 sm:pt-16">
        <Hero />
        <TerritoryBanner />
        <FeatureScrollStory />
      </main>
      <SiteFooter />
    </div>
  );
}
