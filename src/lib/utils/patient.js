export function fullName(p) {
  return `${p.first_name} ${p.last_name}`.trim();
}


export function calculateAge(birthdate) {
  if (!birthdate) return null;
  const [y, m, d] = birthdate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}


export function formatDateOnly(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
