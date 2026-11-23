export const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "receptionist", label: "Receptionist" },
];
export const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));
