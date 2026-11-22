"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HeartPulse, LayoutDashboard, Users, CalendarDays, Stethoscope, Pill, Receipt,
  ChartColumn, UserCog, ScrollText, DatabaseBackup, X,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

const ICONS = {
  dashboard: LayoutDashboard, patients: Users, appointments: CalendarDays, consultations: Stethoscope,
  medicines: Pill, billing: Receipt, reports: ChartColumn, users: UserCog, audit: ScrollText, backup: DatabaseBackup,
};

export default function Sidebar({ role, open, onClose }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white px-4 py-5 transition md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <HeartPulse size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">{siteConfig.shortName}</span>
          </Link>
          <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Main">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-xs font-medium text-slate-400">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((i) => {
                  const Icon = ICONS[i.icon];
                  const active = pathname.startsWith(i.href);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      {Icon && <Icon size={18} aria-hidden="true" className={active ? "text-brand-600" : "text-slate-400"} />}
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <p className="mt-4 px-3 text-xs text-slate-400">{siteConfig.description}</p>
      </aside>
    </>
  );
}
