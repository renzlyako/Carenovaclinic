import { z } from "zod";
import { APPOINTMENT_STATUS } from "@/lib/constants/status";
import { UUID_REGEX } from "@/lib/utils/forms";


const scheduleBase = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date and time are required")
  .refine((v) => !Number.isNaN(new Date(`${v}:00+08:00`).getTime()), "Invalid date and time");

const shared = {
  patient_id: z.string().regex(UUID_REGEX, "Please select a patient"),
  doctor_id: z.string().regex(UUID_REGEX, "Please select a doctor"),
  reason: z.string().trim().max(255, "Maximum 255 characters"),
};


export const appointmentCreateSchema = z.object({
  ...shared,
  schedule: scheduleBase.refine(
    (v) => new Date(`${v}:00+08:00`).getTime() >= Date.now() - 60_000,
    "The appointment time must be in the future"
  ),
});

export const appointmentUpdateSchema = z.object({
  ...shared,
  schedule: scheduleBase,
  status: z.enum(APPOINTMENT_STATUS, { error: "Please select a status" }),
});

export const APPOINTMENT_CREATE_FIELDS = ["patient_id", "doctor_id", "schedule", "reason"];
export const APPOINTMENT_UPDATE_FIELDS = [...APPOINTMENT_CREATE_FIELDS, "status"];
