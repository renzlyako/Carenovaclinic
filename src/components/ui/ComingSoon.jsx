export default function ComingSoon({ todo = [] }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
      <p className="mb-2 font-medium">🚧 This module is not finished yet.</p>
      {todo.length > 0 && (
        <ul className="list-inside list-disc space-y-1">
          {todo.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}
