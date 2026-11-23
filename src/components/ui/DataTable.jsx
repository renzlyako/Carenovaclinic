export default function DataTable({ columns, rows, empty = "No records found." }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows?.length ? rows.map((r, i) => (
            <tr key={r.id ?? i} className="transition hover:bg-slate-50/60">
              {columns.map((c) => <td key={c.key} className="px-4 py-3 text-slate-700">{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
