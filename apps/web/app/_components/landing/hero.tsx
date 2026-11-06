import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const GITHUB_URL = "https://github.com/swarooppatilx/stryde";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-12 pb-20 md:px-10 md:pt-20 md:pb-28">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[560px] w-full max-w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_#fff0e8_0%,_#fffbf9_45%,_transparent_75%)] blur-2xl" />

      <div className="mx-auto flex max-w-[1280px] flex-col items-center text-center">
        <h1 className="m-0 max-w-4xl text-[44px] font-normal leading-[1.08] tracking-[-0.03em] text-[#0b0e14] sm:text-[64px] md:text-[84px]">
          Run with the community.
          <br />
          <span className="font-medium text-[var(--color-brand)]">
            Own the map.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-[#7a828a] sm:text-[19px]">
          An open sports network where your mileage captures real physical
          territory. Verified with World ID, stored onchain.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/maps"
            className="inline-flex items-center rounded-full bg-[#0b0e14] px-7 py-3.5 text-[15px] font-medium text-white shadow-sm transition-all hover:bg-black no-underline"
          >
            Explore Map
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#ebecee] bg-white px-6 py-3.5 text-[15px] font-medium text-[#0b0e14] shadow-sm transition-all hover:border-[#0b0e14] no-underline"
          >
            <span>GitHub Repository</span>
            <ArrowUpRight size={16} className="text-[#7a828a]" />
          </a>
        </div>

        <div className="relative mt-16 w-full max-w-[980px]">
          <div className="relative overflow-hidden rounded-[32px] border border-[#ebecee] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.06)] md:p-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[24px] bg-[#0b0e14]">
              <Image
                src="/home/hero-run.jpg"
                alt="Community running"
                fill
                sizes="(max-width: 1024px) 100vw, 980px"
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-4 text-left text-white">
                <div>
                  <p className="mt-2 text-2xl font-medium tracking-tight">
                    Pune Central Territory Sprint
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
