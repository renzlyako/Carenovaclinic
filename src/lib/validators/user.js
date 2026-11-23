import { z } from "zod";
import { passwordSchema } from "@/lib/validators/password";
import { ROLES } from "@/lib/constants/roles";

export const USER_CREATE_FIELDS = ["full_name", "email", "password", "role", "specialization", "license_no"];
export const USER_UPDATE_FIELDS = ["full_name", "role", "specialization", "license_no"];

const roleSchema = z.enum(Object.values(ROLES), { message: "Select a role" });

const base = {
  full_name: z.string().min(2, "Enter the full name").max(120, "Too long"),
  role: roleSchema,
  specialization: z.string().max(120, "Too long"),
  license_no: z.string().max(60, "Too long"),
};

function requireDoctorFields(v, ctx) {
  if (v.role !== ROLES.DOCTOR) return;
  if (!v.specialization) ctx.addIssue({ code: "custom", path: ["specialization"], message: "Required for doctors" });
  if (!v.license_no) ctx.addIssue({ code: "custom", path: ["license_no"], message: "Required for doctors" });
}

export const userCreateSchema = z
  .object({
    ...base,
    email: z.string().email("Enter a valid email address").max(254, "Too long"),
    password: passwordSchema,
  })
  .superRefine(requireDoctorFields);

export const userUpdateSchema = z.object(base).superRefine(requireDoctorFields);

export const resetPasswordSchema = z.object({ password: passwordSchema });
