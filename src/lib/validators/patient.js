import { z } from "zod";
import { SEX_OPTIONS } from "@/lib/constants/status";


const PHONE = /^[0-9+ -]{7,15}$/;
const PHONE_MESSAGE = "Enter a valid number (7-15 characters: digits, +, - or spaces)";


const todayUtc = () => new Date().toISOString().slice(0, 10);

export const patientSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80, "Maximum 80 characters"),
  last_name: z.string().trim().min(1, "Last name is required").max(80, "Maximum 80 characters"),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Birthdate is required")
    .refine((v) => v >= "1900-01-01", "Birthdate is too far in the past")
    .refine((v) => v <= todayUtc(), "Birthdate cannot be in the future"),
  sex: z.enum(SEX_OPTIONS, { error: "Please select a sex" }),
  contact_no: z.string().trim().regex(PHONE, PHONE_MESSAGE),
  address: z.string().trim().max(255, "Maximum 255 characters"),
  emergency_contact_name: z.string().trim().max(120, "Maximum 120 characters"),
  emergency_contact_no: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE.test(v), PHONE_MESSAGE),
});


export const PATIENT_FIELDS = [
  "first_name",
  "last_name",
  "birthdate",
  "sex",
  "contact_no",
  "address",
  "emergency_contact_name",
  "emergency_contact_no",
];
