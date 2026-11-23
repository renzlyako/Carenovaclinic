import { cn } from "@/lib/utils/cn";

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  blue: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
};

export default function KpiCard({ label, value, hint, icon: Icon, tone = "brand", hintTone }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-h-[2.5rem] text-sm text-slate-500">{label}</p>
        {Icon && (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONES[tone] ?? TONES.brand)}>
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className={cn("mt-1 text-xs", hintTone === "bad" ? "font-medium text-red-600" : "text-slate-500")}>{hint}</p>}
    </section>
  );
}
