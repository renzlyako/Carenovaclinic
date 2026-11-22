import { LogOut, Menu } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";

const ROLE_LABEL = { admin: "Admin", doctor: "Doctor", receptionist: "Receptionist" };

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "U";
}

export default function Topbar({ user, onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
      <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(user.full_name)}
          </span>
          <div className="text-left text-sm leading-tight">
            <div className="font-medium text-slate-800">{user.full_name}</div>
            <div className="text-xs text-slate-500">{ROLE_LABEL[user.role] ?? user.role}</div>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Log out"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </form>
      </div>
    </header>
  );
}
