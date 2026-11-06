import { Crown, MessageCircle, ThumbsUp } from "lucide-react";

export type ActivityPost = {
  id: string;
  athleteName: string;
  athleteInitials: string;
  timeAgo: string;
  title: string;
  note: string;
  distance: string;
  duration: string;
  pace: string;
  elevation: string;
  territoryClaimed: string;
  kudosCount: number;
  commentsCount: number;
};

export function ActivityCard({ post }: { post: ActivityPost }) {
  return (
    <article className="flex flex-col gap-5 rounded-[24px] border border-[#ebecee] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] sm:p-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0e6] text-[13px] font-semibold text-[var(--color-brand)]">
            {post.athleteInitials}
          </div>
          <div>
            <p className="m-0 text-[15px] font-semibold text-[#0b0e14]">
              {post.athleteName}
            </p>
            <p className="m-0 text-[12px] text-[#7a828a]">{post.timeAgo}</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ebecee] bg-[#faf9f8] px-3 py-1 text-[12px] font-medium text-[var(--color-brand)]">
          <Crown size={13} />
          {post.territoryClaimed}
        </span>
      </div>

      <div>
        <p className="m-0 text-[18px] font-medium tracking-tight text-[#0b0e14]">
          {post.title}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-[#7a828a]">
          {post.note}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-[16px] border border-[#ebecee] bg-[#faf9f8] p-4 sm:grid-cols-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#7a828a]">
            Distance
          </span>
          <p className="m-0 mt-0.5 text-[16px] font-medium text-[#0b0e14]">
            {post.distance}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#7a828a]">
            Duration
          </span>
          <p className="m-0 mt-0.5 text-[16px] font-medium text-[#0b0e14]">
            {post.duration}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#7a828a]">
            Pace
          </span>
          <p className="m-0 mt-0.5 text-[16px] font-medium text-[#0b0e14]">
            {post.pace}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#7a828a]">
            Elevation
          </span>
          <p className="m-0 mt-0.5 text-[16px] font-medium text-[#0b0e14]">
            {post.elevation}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 text-[13px] text-[#7a828a]">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#ebecee] bg-white px-3.5 py-1.5 transition-colors hover:border-[#0b0e14] hover:text-[#0b0e14]"
        >
          <ThumbsUp size={14} />
          <span>{post.kudosCount}</span>
        </button>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#ebecee] bg-white px-3.5 py-1.5 transition-colors hover:border-[#0b0e14] hover:text-[#0b0e14]"
        >
          <MessageCircle size={14} />
          <span>{post.commentsCount}</span>
        </button>
      </div>
    </article>
  );
}
