import { Calendar, Trophy } from "lucide-react";

const CHALLENGE = {
  title: "ASSOS SHIFT Territory Grand Prix",
  tag: "Featured Grand Prix",
  sport: "Ride 91km in 14 days",
  reward:
    "Enter to win an onchain Commemorative Kit NFT plus 15% partner gear discounts.",
  dates: "7 Sept to 20 Sept",
  prizePool: "2.5 ETH + Sector Master Badge",
};

export function FeaturedChallenge() {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] border border-[#ebecee] bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0e6] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)] sm:p-10">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">
          <Trophy size={13} />
          {CHALLENGE.tag}
        </span>
        <span className="text-[13px] font-medium text-[var(--color-brand)]">
          Open Registration
        </span>
      </div>

      <div>
        <h2 className="m-0 text-[26px] font-medium tracking-tight text-[#0b0e14] sm:text-[32px]">
          {CHALLENGE.title}
        </h2>
        <p className="mt-1 text-[16px] font-medium text-[#0b0e14]/80">
          {CHALLENGE.sport}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#7a828a]">
          {CHALLENGE.reward}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-[#ebecee] pt-5 text-[13px] text-[#0b0e14]">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ebecee] bg-white px-3.5 py-1.5 shadow-sm">
          <Calendar size={14} className="text-[#7a828a]" />
          {CHALLENGE.dates}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ebecee] bg-white px-3.5 py-1.5 shadow-sm">
          <Trophy size={14} className="text-[var(--color-brand)]" />
          {CHALLENGE.prizePool}
        </span>
      </div>
    </div>
  );
}
