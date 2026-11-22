import { z } from "zod";

export const MEDICINE_FIELDS = ["name", "description", "stock_qty", "reorder_level", "unit_price"];

const wholeNumber = (label, max) =>
  z
    .string()
    .regex(/^\d+$/, `${label} must be a whole number (0 or more)`)
    .transform(Number)
    .refine((n) => n <= max, `${label} is too large`);

export const medicineSchema = z.object({
  name: z.string().trim().min(1, "Medicine name is required").max(120, "Maximum 120 characters"),
  description: z.string().trim().max(255, "Maximum 255 characters"),
  stock_qty: wholeNumber("Stock", 1_000_000),
  reorder_level: wholeNumber("Reorder level", 1_000_000),
  unit_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a price like 12 or 12.50")
    .transform(Number)
    .refine((n) => n <= 1_000_000, "Price is too large"),
});
