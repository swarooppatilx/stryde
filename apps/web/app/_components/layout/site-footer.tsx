import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StrydeMark } from "../icons/stryde-mark";

const GITHUB_URL = "https://github.com/swarooppatilx/stryde";

const usefulLinks = [
  { label: "Activities", href: "/activities" },
  { label: "Challenges", href: "/challenges" },
  { label: "Territory Map", href: "/maps" },
];

const aboutLinks = [
  {
    label: "ETHOnline Registration",
    href: "https://ethglobal.com/showcase/stryde-yh9p9",
  },
  { label: "Source Code", href: GITHUB_URL },
  { label: "World ID Verification", href: "https://world.org/" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#ebecee] bg-[#faf9f8] px-6 pb-12 pt-16 md:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <StrydeMark width={16} height={26} />
              <span className="text-[17px] font-semibold tracking-tight text-[#0b0e14]">
                STRYDE
              </span>
            </div>
            <p className="m-0 max-w-sm text-[14px] leading-relaxed text-[#7a828a]">
              The community running protocol. Track routes, claim onchain
              territories, and verify your human achievements.
            </p>
            <div className="pt-2">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#ebecee] bg-white px-4 py-2 text-[13px] font-medium text-[#0b0e14] shadow-sm transition-all hover:border-[#0b0e14] no-underline"
              >
                <span>View on GitHub</span>
                <ArrowUpRight size={14} className="text-[#7a828a]" />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
              Protocol
            </span>
            {usefulLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] text-[#0b0e14] no-underline transition-colors hover:text-[var(--color-brand)]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[#7a828a]">
              Ecosystem
            </span>
            {aboutLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[14px] text-[#0b0e14] no-underline transition-colors hover:text-[var(--color-brand)]"
              >
                <span>{link.label}</span>
                <ArrowUpRight size={13} className="text-[#7a828a]" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[#ebecee] pt-8 text-[13px] text-[#7a828a] sm:flex-row">
          <span>Stryde Protocol</span>
          <span>Open source athletic layer on Ethereum</span>
        </div>
      </div>
    </footer>
  );
}
