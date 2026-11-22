import { ROLES } from "./roles";

// Sidebar items, grouped. "roles" decides who can see each item; "icon" is a key in Sidebar's icon map (lucide).
export const NAV_GROUPS = [
  {
    label: "Main Menu",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard", roles: Object.values(ROLES) },
      { label: "Patients", href: "/patients", icon: "patients", roles: Object.values(ROLES) },
      { label: "Appointments", href: "/appointments", icon: "appointments", roles: Object.values(ROLES) },
      { label: "Consultations", href: "/consultations", icon: "consultations", roles: [ROLES.ADMIN, ROLES.DOCTOR] },
    ],
  },
  {
    label: "Pharmacy & Billing",
    items: [
      { label: "Medicines", href: "/medicines", icon: "medicines", roles: Object.values(ROLES) },
      { label: "Billing", href: "/billing", icon: "billing", roles: Object.values(ROLES) },
      { label: "Reports", href: "/reports", icon: "reports", roles: [ROLES.ADMIN, ROLES.RECEPTIONIST] },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: "users", roles: [ROLES.ADMIN] },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: "audit", roles: [ROLES.ADMIN] },
      { label: "Backup & Restore", href: "/admin/backup", icon: "backup", roles: [ROLES.ADMIN] },
    ],
  },
];

// Flat list (kept for any code that needs every item).
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
