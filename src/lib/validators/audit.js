import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_TABLES } from "@/lib/constants/audit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v) => v === "" || (DATE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()));

// Query string of the Audit Logs page. Unknown values are rejected (the page falls back to "no filter").
export const auditQuerySchema = z
  .object({
    user: z.string().trim().max(100),
    action: z.string().refine((v) => v === "" || AUDIT_ACTIONS.includes(v), "Unknown action"),
    table: z.string().refine((v) => v === "" || AUDIT_TABLES.includes(v), "Unknown table"),
    from: z.string().refine(validDate, "Invalid start date"),
    to: z.string().refine(validDate, "Invalid end date"),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: "The start date must be before the end date", path: ["from"] });
