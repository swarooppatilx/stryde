import { Bike, Footprints, Mountain, Ruler } from "lucide-react";

const TAGS = [
  { label: "Run", icon: Footprints, active: true },
  { label: "Ride", icon: Bike, active: false },
  { label: "Walk", icon: Footprints, active: false },
  { label: "Hike", icon: Mountain, active: false },
  { label: "Distance", icon: Ruler, active: false },
  { label: "Elevation", icon: Mountain, active: false },
];

export function FilterTags() {
  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map(({ label, icon: Icon, active }) => (
        <button
          key={label}
          type="button"
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
            active
              ? "bg-[#0b0e14] text-white shadow-sm"
              : "border border-[#ebecee] bg-white text-[#7a828a] hover:border-[#0b0e14] hover:text-[#0b0e14]"
          }`}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
