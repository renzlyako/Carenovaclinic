import { z } from "zod";

export const REPORT_TYPES = [
  "daily_collection",
  "outstanding_invoices",
  "patients_per_doctor",
  "appointment_status",
  "top_diagnoses",
  "low_stock",
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v) => DATE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

// Query string of /reports and /api/reports. Dates are optional (defaults are applied in the service).
export const reportQuerySchema = z
  .object({
    type: z.enum(REPORT_TYPES, { error: "Unknown report type" }),
    from: z.string().refine((v) => v === "" || validDate(v), "Invalid start date"),
    to: z.string().refine((v) => v === "" || validDate(v), "Invalid end date"),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: "The start date must be before the end date", path: ["from"] });
