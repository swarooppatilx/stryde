"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

const GITHUB_URL = "https://github.com/swarooppatilx/stryde";

export function Hero() {
  const trackRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.7],
    [
      "inset(16vh 10vw 16vh 10vw round 32px)",
      "inset(0vh 0vw 0vh 0vw round 0px)",
    ]
  );
  const imageScale = useTransform(scrollYProgress, [0, 0.7], [1.2, 1]);
  const overlayOpacity = useTransform(scrollYProgress, [0.4, 0.7], [0, 1]);
  const overlayY = useTransform(scrollYProgress, [0.4, 0.7], [24, 0]);

  return (
    <>
      <section className="relative overflow-hidden px-6 pt-12 pb-10 md:px-10 md:pt-20 md:pb-12">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[560px] w-full max-w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_#fff0e8_0%,_#fffbf9_45%,_transparent_75%)]" />

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
        </div>
      </section>

      <div ref={trackRef} className="relative h-[240vh]">
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
          <motion.div
            style={{ clipPath }}
            className="absolute inset-0 transform-gpu bg-[#0b0e14] will-change-[clip-path]"
          >
            <motion.div
              style={{ scale: imageScale }}
              className="absolute inset-0 transform-gpu will-change-transform"
            >
              <Image
                src="/home/hero-run.jpg"
                alt="Community running"
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
            </motion.div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

            <motion.div
              style={{ opacity: overlayOpacity, y: overlayY }}
              className="absolute bottom-8 left-6 right-6 text-left text-white md:bottom-12 md:left-12"
            >
              <p className="text-2xl font-medium tracking-tight md:text-4xl">
                Pune Central Territory Sprint
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
