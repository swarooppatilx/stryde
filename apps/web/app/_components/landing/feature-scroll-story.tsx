'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type StoryStep = {
  tag: string;
  title: string;
  body: string;
  screenshot: string;
  alt: string;
};

const STEPS: StoryStep[] = [
  {
    tag: 'Progress',
    title: 'All metrics in a unified feed',
    body: 'Track elevation, pace, and split times on clean verifiable dashboards designed for everyday physical performance.',
    screenshot: '/home/4.png',
    alt: 'Profile showing weekly distance, time, and territory stats',
  },
  {
    tag: 'Ownership',
    title: 'Claim sectors on the map',
    body: 'Every run encloses real geographic space. Turn your route into an onchain zone with clear polygon boundaries.',
    screenshot: '/home/5.png',
    alt: 'Captured territory shared from a run on the map',
  },
  {
    tag: 'Social',
    title: 'Compete with fellow runners',
    body: 'Share runs, send kudos, and exchange comments with neighborhood athletes across local and global routes.',
    screenshot: '/home/3.png',
    alt: 'Activity feed showing shared runs and streak',
  },
  {
    tag: 'Ecosystem',
    title: 'Join community challenges',
    body: 'Participate in sponsored sector races and unlock commemorative gear rewards and leaderboard placements.',
    screenshot: '/home/2.png',
    alt: 'Browsing community events and challenges with stakes',
  },
  {
    tag: 'Identity',
    title: 'Keep your records portable',
    body: 'Your streak and territorial dominance remain bound to your decentralized address, safe from platform lock-in.',
    screenshot: '/home/6.png',
    alt: 'Detailed run view with telemetry and map route',
  },
  {
    tag: 'Sybil Resistance',
    title: 'World ID verified runners',
    body: 'Zero bot entries. Ensure every competitor on the leaderboard and map is an authentic, verified human athlete.',
    screenshot: '/home/1.png',
    alt: 'Profile with verified badge, wallet, and athlete pass',
  },
];

function Phone({ activeIndex }: { activeIndex: number | null; className?: string }) {
  return (
    <div className="relative isolate aspect-[279/549] w-[240px] sm:w-[270px] lg:w-[300px]">
      <div className="absolute left-[8.6%] top-[4.2%] z-10 h-[91.6%] w-[83%] overflow-hidden rounded-[22px] bg-[#0b0e14]">
        {STEPS.map((step, i) => (
          <Image
            key={step.screenshot}
            src={step.screenshot}
            alt={step.alt}
            fill
            sizes="300px"
            priority={i < 2}
            className={`object-cover object-top transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              i === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>

      <Image
        src="/home/phone-frame.png"
        alt=""
        fill
        sizes="300px"
        priority
        className="pointer-events-none z-0 select-none object-contain drop-shadow-[0_30px_60px_rgba(11,14,20,0.18)]"
      />
    </div>
  );
}

export function FeatureScrollStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const root = document.documentElement;
    const previousScrollSnapType = root.style.scrollSnapType;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const updateScrollSnap = () => {
      root.style.scrollSnapType = mediaQuery.matches ? 'y proximity' : previousScrollSnapType;
    };

    updateScrollSnap();
    mediaQuery.addEventListener('change', updateScrollSnap);

    return () => {
      mediaQuery.removeEventListener('change', updateScrollSnap);
      root.style.scrollSnapType = previousScrollSnapType;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = Number(entry.target.getAttribute('data-step-index'));
            if (!Number.isNaN(i)) setActiveIndex(i);
          }
        });
      },
      {
        rootMargin: '-45% 0px -45% 0px',
        threshold: 0,
      }
    );

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToStep = (i: number) =>
    stepRefs.current[i]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

  return (
    <section className="px-6 py-20 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <div className="mx-auto mb-0 max-w-2xl text-center">
          <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#7a828a]">
            Architecture
          </span>
          <h2 className="mt-3 text-[34px] font-normal leading-[1.1] tracking-tight text-[#0b0e14] sm:text-[52px]">
            Engineered for physical performance.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-[#7a828a]">
            A high-fidelity athletic protocol connecting real movement with verifiable onchain
            boundaries.
          </p>
        </div>

        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-24">
          <div>
            {STEPS.map((step, i) => {
              const isActive = i === activeIndex;

              return (
                <article
                  key={step.title}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  data-step-index={i}
                  className="flex min-h-[75vh] snap-center items-center"
                >
                  <div
                    className={`max-w-md transition-all duration-500 ease-out motion-reduce:transition-none ${
                      isActive ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-25'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-[13px] font-medium text-[#7a828a]">
                      <span className="tabular-nums text-[#0b0e14]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="h-px w-8 bg-[#d9dce0]" />
                      <span className="uppercase tracking-[0.14em]">{step.tag}</span>
                    </div>

                    <h3 className="mt-5 text-[44px] font-normal leading-[1.15] tracking-tight text-[#0b0e14]">
                      {step.title}
                    </h3>

                    <p className="mt-4 text-[21px] leading-relaxed text-[#7a828a]">{step.body}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="relative">
            <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center justify-center">
              <div
                aria-hidden
                className="absolute aspect-square w-[460px] rounded-full bg-[radial-gradient(circle,rgba(11,14,20,0.06)_0%,rgba(11,14,20,0)_65%)]"
              />

              <Phone activeIndex={activeIndex} />

              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-3">
                {STEPS.map((step, i) => (
                  <button
                    key={step.title}
                    type="button"
                    aria-label={`Go to ${step.title}`}
                    onClick={() => scrollToStep(i)}
                    className="group flex h-4 w-4 items-center justify-center"
                  >
                    <span
                      className={`block rounded-full bg-[#0b0e14] transition-all duration-300 ${
                        i === activeIndex
                          ? 'h-5 w-[3px] opacity-100'
                          : 'h-[5px] w-[5px] opacity-20 group-hover:opacity-50'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-20 lg:hidden">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a828a]">
                {String(i + 1).padStart(2, '0')} · {step.tag}
              </span>

              <h3 className="mt-3 max-w-sm text-[26px] font-normal leading-[1.15] tracking-tight text-[#0b0e14]">
                {step.title}
              </h3>

              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#7a828a]">
                {step.body}
              </p>

              <div className="mt-8">
                <StaticPhone step={step} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StaticPhone({ step }: { step: StoryStep }) {
  return (
    <div className="relative aspect-[279/549] w-[230px]">
      <div className="absolute left-[8.6%] top-[4.2%] z-10 h-[91.6%] w-[83%] overflow-hidden rounded-[20px] bg-[#0b0e14]">
        <Image
          src={step.screenshot}
          alt={step.alt}
          fill
          sizes="230px"
          className="object-cover object-top"
        />
      </div>

      <Image
        src="/home/phone-frame.png"
        alt=""
        fill
        sizes="230px"
        className="pointer-events-none z-20 drop-shadow-[0_24px_48px_rgba(11,14,20,0.15)]"
      />
    </div>
  );
}
