// Helpers to show audit entries in a readable way.

const IGNORED = new Set(["updated_at"]);

// For an UPDATE: which columns changed? -> [{ key, from, to }]
export function changedFields(oldData, newData) {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const out = [];
  for (const key of keys) {
    if (IGNORED.has(key)) continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) out.push({ key, from: oldData[key], to: newData[key] });
  }
  return out;
}

export const shortId = (id) => (id ? String(id).slice(0, 8) : "-");

export function displayValue(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
