import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const variants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  secondary: "bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50",
};

// A link that looks like a Button. icon = optional lucide component, shown before the text.
export default function LinkButton({ href, variant = "primary", small = false, className, icon: Icon, children }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
        small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        variants[variant],
        className
      )}
    >
      {Icon && <Icon size={small ? 14 : 16} aria-hidden="true" />}
      {children}
    </Link>
  );
}
