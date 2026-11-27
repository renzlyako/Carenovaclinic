// Shown instantly by Next.js while any page under (dashboard) is still
// fetching its data on the server, instead of a blank/frozen screen.
// The sidebar/header (DashboardShell) stays visible since this only
// replaces the inner page content.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4 p-4 md:p-6" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="h-4 w-72 rounded bg-slate-200" />
      <div className="h-24 rounded-xl border border-slate-200 bg-slate-100" />
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 rounded bg-slate-200" style={{ width: `${85 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}
