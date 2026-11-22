"use client";

// Shown when a page in the dashboard throws an error (for example the database is unreachable).
export default function DashboardError({ error, reset }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-600">
        We could not load this page. Please try again. If the problem continues, contact the administrator.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-3 overflow-x-auto rounded bg-slate-50 p-2 text-left text-xs text-red-700">{error.message}</pre>
      )}
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
