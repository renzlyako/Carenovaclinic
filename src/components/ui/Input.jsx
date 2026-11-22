import { cn } from "@/lib/utils/cn";

export default function Input({ label, error, className, id, ...props }) {
  const inputId = id || props.name;
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">{label}</label>}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-lg border border-slate-200 shadow-sm px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
          error && "border-red-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
