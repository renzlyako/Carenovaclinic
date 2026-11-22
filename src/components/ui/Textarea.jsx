import { cn } from "@/lib/utils/cn";

export default function Textarea({ label, error, className, id, rows = 4, ...props }) {
  const fieldId = id || props.name;
  return (
    <div className="space-y-1">
      {label && <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        id={fieldId}
        rows={rows}
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
