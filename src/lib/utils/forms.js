// Helpers for reading and validating form submissions in Server Actions.

// Read the given keys from FormData as trimmed strings.
export function formDataToObject(formData, keys) {
  const out = {};
  for (const key of keys) out[key] = String(formData.get(key) ?? "").trim();
  return out;
}

// Convert a zod error into { fieldName: "first error message" }.
export function zodFieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// Empty optional inputs are stored as NULL in the database.
export const nullIfEmpty = (value) => (value === "" || value == null ? null : value);

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
