"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { logAuditEvent } from "@/lib/audit/log";
import { formDataToObject, zodFieldErrors, UUID_REGEX } from "@/lib/utils/forms";
import {
  userCreateSchema, userUpdateSchema, resetPasswordSchema,
  USER_CREATE_FIELDS, USER_UPDATE_FIELDS,
} from "@/lib/validators/user";
import { createUser, updateUser, setUserActive, resetUserPassword } from "@/services/users.service";

const ADMIN_ONLY = [ROLES.ADMIN];

const withoutPassword = ({ password, ...rest }) => rest;

export async function createUserAction(prevState, formData) {
  const admin = await requireRole(ADMIN_ONLY);

  const values = formDataToObject(formData, USER_CREATE_FIELDS);
  values.email = values.email.toLowerCase();
  const parsed = userCreateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values: withoutPassword(values) };

  const { data, error, rawError } = await createUser(parsed.data);
  if (error) {
    if (rawError) console.error("createUser failed:", rawError);
    return { error, values: withoutPassword(values) };
  }

  await logAuditEvent({
    userId: admin.id, userEmail: admin.email, action: "ADMIN_CREATE_USER",
    details: { target_user: data.id, email: parsed.data.email, role: parsed.data.role },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?msg=created");
}

export async function updateUserAction(id, prevState, formData) {
  const admin = await requireRole(ADMIN_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid user." };

  const values = formDataToObject(formData, USER_UPDATE_FIELDS);
  const parsed = userUpdateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error, rawError } = await updateUser(id, admin.id, parsed.data);
  if (error) {
    if (rawError) console.error("updateUser failed:", rawError);
    return { error, values };
  }

  await logAuditEvent({
    userId: admin.id, userEmail: admin.email, action: "ADMIN_UPDATE_USER",
    details: { target_user: id, before: data.before, after: data.after },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?msg=updated");
}

export async function setUserActiveAction(id, active, prevState) {
  const admin = await requireRole(ADMIN_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid user." };

  const { error, rawError } = await setUserActive(id, admin.id, active);
  if (error) {
    if (rawError) console.error("setUserActive failed:", rawError);
    return { error };
  }

  await logAuditEvent({
    userId: admin.id, userEmail: admin.email,
    action: active ? "ADMIN_ENABLE_USER" : "ADMIN_DISABLE_USER",
    details: { target_user: id },
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users?msg=${active ? "enabled" : "disabled"}`);
}

export async function resetPasswordAction(id, prevState, formData) {
  const admin = await requireRole(ADMIN_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid user." };

  const parsed = resetPasswordSchema.safeParse({ password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  const { error, rawError } = await resetUserPassword(id, parsed.data.password);
  if (error) {
    if (rawError) console.error("resetPassword failed:", rawError);
    return { error };
  }

  await logAuditEvent({
    userId: admin.id, userEmail: admin.email, action: "ADMIN_RESET_PASSWORD",
    details: { target_user: id }, 
  });
  return { success: "Password changed. Share the new password with the user securely." };
}
