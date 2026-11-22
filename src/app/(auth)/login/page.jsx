import { HeartPulse, ShieldCheck, CalendarDays, Receipt } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Login | CareNova" };

const HIGHLIGHTS = [
  { icon: CalendarDays, text: "Appointments without double-booking" },
  { icon: Receipt, text: "Billing and payments you can trust" },
  { icon: ShieldCheck, text: "Role-based access and a full audit trail" },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">{siteConfig.shortName}</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Care for patients, not paperwork.</h2>
          <p className="mt-3 max-w-md text-brand-50/90">{siteConfig.description}</p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><Icon size={16} aria-hidden="true" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-50/70">{siteConfig.name}</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"><HeartPulse size={20} aria-hidden="true" /></span>
            <span className="text-lg font-semibold">{siteConfig.shortName}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to your account to continue.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
