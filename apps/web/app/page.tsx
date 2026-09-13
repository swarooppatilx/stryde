import { FeatureGrid } from './_components/home/FeatureGrid';
import { Hero } from './_components/home/Hero';
import { SiteFooter } from './_components/home/SiteFooter';
import { SiteHeader } from './_components/home/SiteHeader';
import { TerritoryBanner } from './_components/home/TerritoryBanner';

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <TerritoryBanner />
      <FeatureGrid />
      <SiteFooter />
    </main>
  );
}
