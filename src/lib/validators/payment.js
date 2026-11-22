import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants/status";

export const PAYMENT_FIELDS = ["amount", "method", "reference_no"];

export const paymentSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 500 or 500.50")
    .transform(Number)
    .refine((n) => n > 0, "Amount must be greater than 0")
    .refine((n) => n <= 1_000_000, "Amount is too large"),
  method: z.enum(PAYMENT_METHODS, { error: "Please select a payment method" }),
  reference_no: z.string().trim().max(60, "Maximum 60 characters"),
});
