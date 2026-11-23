"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { UserProvider } from "@/context/UserContext";

export default function DashboardShell({ user, children }) {
  const [open, setOpen] = useState(false);
  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen bg-slate-50/80">
        <Sidebar role={user.role} open={open} onClose={() => setOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} onMenuClick={() => setOpen(true)} />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </UserProvider>
  );
}
