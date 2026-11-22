import { cn } from "@/lib/utils/cn";

const tones = {
  gray: "bg-slate-50 text-slate-600 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};
const dots = { gray: "bg-slate-400", green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500", blue: "bg-sky-500", purple: "bg-violet-500" };

export default function Badge({ tone = "gray", children }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone] ?? tones.gray)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone] ?? dots.gray)} aria-hidden="true" />
      {children}
    </span>
  );
}
