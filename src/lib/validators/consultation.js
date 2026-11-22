import { z } from "zod";
import { UUID_REGEX } from "@/lib/utils/forms";

export const CONSULTATION_FIELDS = ["diagnosis", "notes"];
export const PRESCRIPTION_FIELDS = ["medicine_id", "dosage", "qty"];

export const consultationSchema = z.object({
  diagnosis: z.string().trim().min(1, "Diagnosis is required").max(500, "Maximum 500 characters"),
  notes: z.string().trim().max(3000, "Maximum 3000 characters"),
});

export const prescriptionSchema = z.object({
  medicine_id: z.string().regex(UUID_REGEX, "Please select a medicine"),
  dosage: z.string().trim().min(1, "Dosage instructions are required").max(150, "Maximum 150 characters"),
  qty: z
    .string()
    .regex(/^\d+$/, "Enter a whole number")
    .transform(Number)
    .refine((n) => n >= 1 && n <= 1000, "Quantity must be between 1 and 1000"),
});
