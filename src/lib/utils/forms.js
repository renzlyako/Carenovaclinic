export function formDataToObject(formData, keys) {
  const out = {};
  for (const key of keys) out[key] = String(formData.get(key) ?? "").trim();
  return out;
}


export function zodFieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const nullIfEmpty = (value) => (value === "" || value == null ? null : value);

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
