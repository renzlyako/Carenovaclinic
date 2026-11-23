import { CLINIC_TIME_ZONE } from "./datetime";

export const formatCurrency = (n) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(n ?? 0));


export const formatDate = (d) =>
  d ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: CLINIC_TIME_ZONE }).format(new Date(d)) : "-";

export const formatDateTime = (d) =>
  d
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: CLINIC_TIME_ZONE }).format(new Date(d))
    : "-";
