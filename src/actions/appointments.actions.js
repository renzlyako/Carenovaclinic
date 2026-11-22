"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  APPOINTMENT_CREATE_FIELDS,
  APPOINTMENT_UPDATE_FIELDS,
} from "@/lib/validators/appointment";
import { formDataToObject, zodFieldErrors, nullIfEmpty, UUID_REGEX } from "@/lib/utils/forms";
import { friendlyDbError } from "@/lib/utils/db-errors";
import { clinicLocalToIso } from "@/lib/utils/datetime";
import {
  createAppointment,
  updateAppointment,
  changeStatusFromScheduled,
  deleteAppointment,
} from "@/services/appointments.service";

const CAN_MANAGE = [ROLES.ADMIN, ROLES.RECEPTIONIST];
const FINAL_STATUSES = ["completed", "cancelled", "no_show"];

function toRow(v) {
  const row = {
    patient_id: v.patient_id,
    doctor_id: v.doctor_id,
    schedule: clinicLocalToIso(v.schedule), // clinic time -> exact moment (UTC)
    reason: nullIfEmpty(v.reason),
  };
  if (v.status) row.status = v.status;
  return row;
}

function appointmentError(error) {
  if (error.code === "23505" && /double_booking/.test(error.message)) {
    return "This doctor already has an appointment at that time. Please choose another time.";
  }
  if (error.code === "23503") return "The selected patient or doctor no longer exists.";
  return friendlyDbError(error);
}

// Book. Used as: useActionState(createAppointmentAction, null)
export async function createAppointmentAction(prevState, formData) {
  await requireRole(CAN_MANAGE);

  const values = formDataToObject(formData, APPOINTMENT_CREATE_FIELDS);
  const parsed = appointmentCreateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error } = await createAppointment(toRow(parsed.data));
  if (error) {
    console.error("createAppointment failed:", error);
    return { error: appointmentError(error), values };
  }

  revalidatePath("/appointments");
  redirect(`/appointments/${data.id}?msg=created`);
}

// Edit / reschedule. Used as: useActionState(updateAppointmentAction.bind(null, id), null)
export async function updateAppointmentAction(id, prevState, formData) {
  await requireRole(CAN_MANAGE);
  if (!UUID_REGEX.test(id)) return { error: "Invalid appointment." };

  const values = formDataToObject(formData, APPOINTMENT_UPDATE_FIELDS);
  const parsed = appointmentUpdateSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error } = await updateAppointment(id, toRow(parsed.data));
  if (error) {
    console.error("updateAppointment failed:", error);
    return { error: appointmentError(error), values };
  }
  if (!data || data.length === 0) {
    return { error: "Appointment not found or you do not have permission to edit it.", values };
  }

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  redirect(`/appointments/${id}?msg=updated`);
}

// Mark completed / cancelled / no_show. Admin, receptionist, and the doctor who owns it.
// Used as: <StatusButtons actions={{ completed: setAppointmentStatusAction.bind(null, id, "completed"), ... }} />
export async function setAppointmentStatusAction(id, status, prevState) {
  await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]);
  if (!UUID_REGEX.test(id) || !FINAL_STATUSES.includes(status)) return { error: "Invalid request." };

  const { data, error } = await changeStatusFromScheduled(id, status);
  if (error) {
    console.error("changeStatus failed:", error);
    return { error: friendlyDbError(error) };
  }
  if (!data || data.length === 0) {
    return { error: "This appointment can no longer be changed, or you do not have permission." };
  }

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  redirect(`/appointments/${id}?msg=${status}`);
}

// Delete (admin only).
export async function deleteAppointmentAction(id, prevState) {
  await requireRole([ROLES.ADMIN]);
  if (!UUID_REGEX.test(id)) return { error: "Invalid appointment." };

  const { data, error } = await deleteAppointment(id);
  if (error) {
    console.error("deleteAppointment failed:", error);
    return { error: friendlyDbError(error, "This appointment cannot be deleted because other records depend on it.") };
  }
  if (!data || data.length === 0) {
    return { error: "Appointment not found or you do not have permission to delete it." };
  }

  revalidatePath("/appointments");
  redirect("/appointments?msg=deleted");
}
