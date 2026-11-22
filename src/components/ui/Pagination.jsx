import Link from "next/link";
import { cn } from "@/lib/utils/cn";

// Server component. Keeps the other query params (like the search text) when changing page.
export default function Pagination({ basePath, page, pageSize, total, params = {} }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const href = (p) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const linkClass = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-slate-50";
  const disabledClass = "inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm text-slate-300";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <p>{total === 0 ? "No results" : `Showing ${from}-${to} of ${total}`}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link className={linkClass} href={href(page - 1)}>Previous</Link> : <span className={disabledClass}>Previous</span>}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages ? <Link className={linkClass} href={href(page + 1)}>Next</Link> : <span className={cn(disabledClass)}>Next</span>}
      </div>
    </div>
  );
}
