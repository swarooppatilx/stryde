import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function TerritoryBanner() {
  return (
    <section className="px-6 py-12 md:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="relative overflow-hidden rounded-[32px] border border-[#ebecee] bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0e6] p-8 md:p-14 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1.3fr]">
            <div className="flex flex-col gap-5">
              <h2 className="m-0 text-[32px] font-normal leading-tight tracking-tight text-[#0b0e14] sm:text-[44px]">
                Capture sectors by completing loops.
              </h2>

              <p className="m-0 text-[16px] leading-relaxed text-[#7a828a]">
                When you run closed loops around parks, blocks, and
                neighborhoods, Stryde computes the enclosed polygon and mints it
                to your profile.
              </p>

              <div className="pt-2">
                <Link
                  href="/maps"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0b0e14] px-6 py-3 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-black no-underline"
                >
                  <span>View Live Sectors</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#ebecee] bg-white p-2 shadow-[0_10px_25px_rgba(0,0,0,0.04)]">
              <Image
                src="/home/phone-territory.png"
                alt="Captured territory on the map"
                width={1982}
                height={848}
                sizes="(max-width: 1024px) 100vw, 640px"
                className="block h-auto w-full rounded-[18px] object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
