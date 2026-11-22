"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { patientSchema, PATIENT_FIELDS } from "@/lib/validators/patient";
import { formDataToObject, zodFieldErrors, nullIfEmpty, UUID_REGEX } from "@/lib/utils/forms";
import { friendlyDbError } from "@/lib/utils/db-errors";
import { createPatient, updatePatient, deletePatient } from "@/services/patients.service";

const CAN_EDIT = [ROLES.ADMIN, ROLES.RECEPTIONIST];

// Validated form values -> database row (empty optional fields become NULL).
function toRow(v) {
  return {
    first_name: v.first_name,
    last_name: v.last_name,
    birthdate: v.birthdate,
    sex: v.sex,
    contact_no: v.contact_no,
    address: nullIfEmpty(v.address),
    emergency_contact_name: nullIfEmpty(v.emergency_contact_name),
    emergency_contact_no: nullIfEmpty(v.emergency_contact_no),
  };
}

// Create. Used as: useActionState(createPatientAction, null)
export async function createPatientAction(prevState, formData) {
  await requireRole(CAN_EDIT); // server-side role check (2nd layer; RLS is the 3rd)

  const values = formDataToObject(formData, PATIENT_FIELDS);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error } = await createPatient(toRow(parsed.data));
  if (error) {
    console.error("createPatient failed:", error);
    return { error: friendlyDbError(error), values };
  }

  revalidatePath("/patients");
  redirect(`/patients/${data.id}?msg=created`);
}

// Update. Used as: useActionState(updatePatientAction.bind(null, id), null)
export async function updatePatientAction(id, prevState, formData) {
  await requireRole(CAN_EDIT);
  if (!UUID_REGEX.test(id)) return { error: "Invalid patient." };

  const values = formDataToObject(formData, PATIENT_FIELDS);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error } = await updatePatient(id, toRow(parsed.data));
  if (error) {
    console.error("updatePatient failed:", error);
    return { error: friendlyDbError(error), values };
  }
  // RLS hides rows silently, so "0 rows updated" means not found or not allowed.
  if (!data || data.length === 0) {
    return { error: "Patient not found or you do not have permission to edit it.", values };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}?msg=updated`);
}

// Delete (admin only). Used as: <ConfirmDeleteButton action={deletePatientAction.bind(null, id)} />
export async function deletePatientAction(id, prevState) {
  await requireRole([ROLES.ADMIN]);
  if (!UUID_REGEX.test(id)) return { error: "Invalid patient." };

  const { data, error } = await deletePatient(id);
  if (error) {
    console.error("deletePatient failed:", error);
    return { error: friendlyDbError(error) };
  }
  if (!data || data.length === 0) {
    return { error: "Patient not found or you do not have permission to delete it." };
  }

  revalidatePath("/patients");
  redirect("/patients?msg=deleted");
}
