export const ROLES = {
  ADMIN: "admin",
  DOCTOR: "doctor",
  RECEPTIONIST: "receptionist",
};


export const ROUTE_ACCESS = {
  "/dashboard": [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST],
  "/patients": [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST],
  "/appointments": [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST],
  "/consultations": [ROLES.ADMIN, ROLES.DOCTOR],
  "/medicines": [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST],
  "/billing": [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR],
  "/reports": [ROLES.ADMIN, ROLES.RECEPTIONIST],
  "/admin": [ROLES.ADMIN],
};

export function canAccess(role, pathname) {
  const prefix = Object.keys(ROUTE_ACCESS).find(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!prefix) return true; 
  return ROUTE_ACCESS[prefix].includes(role);
}
