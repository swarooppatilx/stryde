"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { StrydeMark } from "../icons/stryde-mark";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/activities", label: "Activities" },
  { href: "/challenges", label: "Challenges" },
  { href: "/maps", label: "Map" },
];

const GITHUB_URL = "https://github.com/swarooppatilx/stryde";

export function SiteHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 30);
          ticking = false;
        });
        ticking = true;
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 pointer-events-none px-4 pt-3 transition-all duration-300 md:px-8 md:pt-4">
      <header
        className={`pointer-events-auto mx-auto flex items-center justify-between transition-all duration-300 ease-in-out ${
          isScrolled
            ? "max-w-[1040px] rounded-full border border-[#ebecee]/90 bg-[#faf9f8]/85 px-4 py-2.5 shadow-[0_22px_42px_rgba(11,24,40,0.1)] backdrop-blur-md md:px-6"
            : "max-w-[1280px] rounded-[24px] border border-transparent bg-[#faf9f8]/50 px-2 py-2 backdrop-blur-sm"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <StrydeMark width={18} height={28} />
          <Image
            src="/home/stryde-wordmark.svg"
            alt="Stryde"
            width={78}
            height={18}
            unoptimized
          />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full p-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors duration-200 no-underline ${
                  isActive ? "text-[#0b0e14]" : "text-[#454b52]"
                }`}
              >
                {item.label}

                {isActive && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-4 -bottom-[1px] h-[2px] rounded-full bg-[#e14502]"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-[#ebecee] bg-white/90 px-4 py-2 text-[13px] font-medium text-[#0b0e14] transition-all hover:border-[#0b0e14] sm:inline-flex no-underline"
          >
            <span>GitHub</span>
            <ArrowUpRight size={14} className="text-[#7a828a]" />
          </a>
          <Link
            href="/maps"
            className="inline-flex items-center rounded-full bg-[#0b0e14] px-5 py-2 text-[13px] font-medium text-white transition-all hover:bg-black no-underline"
          >
            Launch Map
          </Link>
        </div>
      </header>
    </div>
  );
}
