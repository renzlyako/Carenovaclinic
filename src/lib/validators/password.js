import { z } from "zod";

// Strong password policy (per the project requirement). Must also match the Supabase Auth settings.
export const passwordSchema = z
  .string()
  .min(10, "Must be at least 10 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");
