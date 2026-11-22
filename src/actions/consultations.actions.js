"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import {
  consultationSchema, prescriptionSchema, CONSULTATION_FIELDS, PRESCRIPTION_FIELDS,
} from "@/lib/validators/consultation";
import { formDataToObject, zodFieldErrors, nullIfEmpty, UUID_REGEX } from "@/lib/utils/forms";
import { friendlyDbError } from "@/lib/utils/db-errors";
import { getAppointment, changeStatusFromScheduled } from "@/services/appointments.service";
import {
  createConsultation, updateConsultation, deleteConsultation, createPrescription, deletePrescription,
} from "@/services/consultations.service";

// Only doctors write clinical records. (Admins can read them. RLS enforces the same rule.)
const DOCTOR_ONLY = [ROLES.DOCTOR];

// Create. Used as: useActionState(createConsultationAction.bind(null, appointmentId), null)
export async function createConsultationAction(appointmentId, prevState, formData) {
  await requireRole(DOCTOR_ONLY);
  if (!UUID_REGEX.test(appointmentId)) return { error: "Invalid appointment." };

  const values = formDataToObject(formData, CONSULTATION_FIELDS);
  const parsed = consultationSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const appointment = await getAppointment(appointmentId); // RLS: only the doctor's own appointment is visible
  if (!appointment) return { error: "Appointment not found or it is not yours.", values };
  if (appointment.status === "cancelled" || appointment.status === "no_show") {
    return { error: "You cannot record a consultation for a cancelled or no-show appointment.", values };
  }

  const { data, error } = await createConsultation({
    appointment_id: appointmentId,
    diagnosis: parsed.data.diagnosis,
    notes: nullIfEmpty(parsed.data.notes),
  });
  if (error) {
    console.error("createConsultation failed:", error);
    if (error.code === "23505") return { error: "A consultation already exists for this appointment.", values };
    return { error: friendlyDbError(error), values };
  }

  // A recorded consultation means the visit happened, so close the appointment.
  if (appointment.status === "scheduled") await changeStatusFromScheduled(appointmentId, "completed");

  revalidatePath("/consultations");
  revalidatePath(`/appointments/${appointmentId}`);
  redirect(`/consultations/${data.id}?msg=created`);
}

// Update diagnosis / notes.
export async function updateConsultationAction(id, prevState, formData) {
  await requireRole(DOCTOR_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid consultation." };

  const values = formDataToObject(formData, CONSULTATION_FIELDS);
  const parsed = consultationSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error } = await updateConsultation(id, {
    diagnosis: parsed.data.diagnosis,
    notes: nullIfEmpty(parsed.data.notes),
  });
  if (error) {
    console.error("updateConsultation failed:", error);
    return { error: friendlyDbError(error), values };
  }
  if (!data || data.length === 0) return { error: "Consultation not found or you do not have permission to edit it.", values };

  revalidatePath("/consultations");
  revalidatePath(`/consultations/${id}`);
  redirect(`/consultations/${id}?msg=updated`);
}

// Delete. Not possible while prescriptions exist (the database protects them).
export async function deleteConsultationAction(id, prevState) {
  await requireRole(DOCTOR_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid consultation." };

  const { data, error } = await deleteConsultation(id);
  if (error) {
    console.error("deleteConsultation failed:", error);
    if (error.code === "23001" || error.code === "23503") {
      return { error: "This consultation still has prescriptions. Remove the prescriptions first (dispensed ones cannot be removed)." };
    }
    return { error: friendlyDbError(error) };
  }
  if (!data || data.length === 0) return { error: "Consultation not found or you do not have permission to delete it." };

  revalidatePath("/consultations");
  redirect("/consultations?msg=deleted");
}

// Add a prescription. Used as: useActionState(addPrescriptionAction.bind(null, consultationId), null)
export async function addPrescriptionAction(consultationId, prevState, formData) {
  await requireRole(DOCTOR_ONLY);
  if (!UUID_REGEX.test(consultationId)) return { error: "Invalid consultation." };

  const values = formDataToObject(formData, PRESCRIPTION_FIELDS);
  const parsed = prescriptionSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { error } = await createPrescription({
    consultation_id: consultationId,
    medicine_id: parsed.data.medicine_id,
    dosage: parsed.data.dosage,
    qty: parsed.data.qty,
  });
  if (error) {
    console.error("createPrescription failed:", error);
    if (error.code === "23503") return { error: "The selected medicine no longer exists.", values };
    if (error.code === "42501") return { error: "You cannot add prescriptions to this consultation.", values };
    return { error: friendlyDbError(error), values };
  }

  revalidatePath(`/consultations/${consultationId}`);
  return { success: "Prescription added.", at: Date.now() };
}

// Remove a prescription that has not been dispensed yet.
// Used as: <ConfirmDeleteButton action={deletePrescriptionAction.bind(null, consultationId, rxId)} />
export async function deletePrescriptionAction(consultationId, id, prevState) {
  await requireRole(DOCTOR_ONLY);
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(consultationId)) return { error: "Invalid prescription." };

  const { data, error } = await deletePrescription(id);
  if (error) {
    console.error("deletePrescription failed:", error);
    if (/dispensed/i.test(error.message ?? "")) return { error: "This prescription was already dispensed and cannot be removed." };
    return { error: friendlyDbError(error) };
  }
  if (!data || data.length === 0) return { error: "Prescription not found, already dispensed, or you do not have permission." };

  revalidatePath(`/consultations/${consultationId}`);
  redirect(`/consultations/${consultationId}?msg=rx_removed`);
}
