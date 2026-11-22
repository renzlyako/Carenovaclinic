import { z } from "zod";
import { UUID_REGEX } from "@/lib/utils/forms";

export const INVOICE_FIELDS = ["patient_id", "appointment_id", "notes", "consultation_fee"];
export const ITEM_FIELDS = ["description", "qty", "unit_price"];

// Money: whole pesos or up to 2 decimals.
const money = (max) =>
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 500 or 500.50")
    .transform(Number)
    .refine((n) => n <= max, "Amount is too large");

export const invoiceSchema = z.object({
  patient_id: z.string().regex(UUID_REGEX, "Please select a patient"),
  appointment_id: z.string().refine((v) => v === "" || UUID_REGEX.test(v), "Invalid appointment"),
  notes: z.string().trim().max(255, "Maximum 255 characters"),
  // Optional first line item. Empty = no consultation fee.
  consultation_fee: z.union([z.literal(""), money(1_000_000)]),
});

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(150, "Maximum 150 characters"),
  qty: z
    .string()
    .regex(/^\d+$/, "Enter a whole number")
    .transform(Number)
    .refine((n) => n >= 1 && n <= 1000, "Quantity must be between 1 and 1000"),
  unit_price: money(1_000_000),
});
