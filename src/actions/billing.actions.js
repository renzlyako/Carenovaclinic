"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { invoiceSchema, invoiceItemSchema, INVOICE_FIELDS, ITEM_FIELDS } from "@/lib/validators/invoice";
import { paymentSchema, PAYMENT_FIELDS } from "@/lib/validators/payment";
import { formDataToObject, zodFieldErrors, nullIfEmpty, UUID_REGEX } from "@/lib/utils/forms";
import { friendlyDbError, businessRuleMessage } from "@/lib/utils/db-errors";
import { getAppointment } from "@/services/appointments.service";
import {
  createInvoice, createInvoiceItem, deleteManualInvoiceItem, createPayment,
  dispensePrescription, voidInvoice, findInvoiceForAppointment,
} from "@/services/billing.service";

const FRONT_DESK = [ROLES.ADMIN, ROLES.RECEPTIONIST];

// Create an invoice (optionally with a consultation fee as the first item).
export async function createInvoiceAction(prevState, formData) {
  await requireRole(FRONT_DESK);

  const values = formDataToObject(formData, INVOICE_FIELDS);
  const parsed = invoiceSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  let patientId = parsed.data.patient_id;
  const appointmentId = parsed.data.appointment_id;

  if (appointmentId) {
    // The appointment decides the patient (never trust the hidden field alone).
    const appointment = await getAppointment(appointmentId);
    if (!appointment) return { error: "Appointment not found.", values };
    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      return { error: "You cannot bill a cancelled or no-show appointment.", values };
    }
    patientId = appointment.patient_id;
    const existing = await findInvoiceForAppointment(appointmentId);
    if (existing) return { error: "An invoice already exists for this appointment.", values };
  }

  const { data, error } = await createInvoice({
    patient_id: patientId,
    appointment_id: nullIfEmpty(appointmentId),
    notes: nullIfEmpty(parsed.data.notes),
  });
  if (error) {
    console.error("createInvoice failed:", error);
    return { error: friendlyDbError(error), values };
  }

  const fee = parsed.data.consultation_fee;
  if (fee !== "" && fee > 0) {
    const { error: itemError } = await createInvoiceItem({
      invoice_id: data.id, description: "Consultation fee", qty: 1, unit_price: fee,
    });
    if (itemError) console.error("consultation fee item failed:", itemError);
  }

  revalidatePath("/billing");
  redirect(`/billing/${data.id}?msg=created`);
}

// Add a manual line item (for example, a procedure or lab fee).
export async function addInvoiceItemAction(invoiceId, prevState, formData) {
  await requireRole(FRONT_DESK);
  if (!UUID_REGEX.test(invoiceId)) return { error: "Invalid invoice." };

  const values = formDataToObject(formData, ITEM_FIELDS);
  const parsed = invoiceItemSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { error } = await createInvoiceItem({ invoice_id: invoiceId, ...parsed.data });
  if (error) {
    console.error("createInvoiceItem failed:", error);
    return { error: businessRuleMessage(error), values };
  }
  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  return { success: "Item added.", at: Date.now() };
}

export async function removeInvoiceItemAction(invoiceId, itemId, prevState) {
  await requireRole(FRONT_DESK);
  if (!UUID_REGEX.test(invoiceId) || !UUID_REGEX.test(itemId)) return { error: "Invalid item." };

  const { data, error } = await deleteManualInvoiceItem(itemId);
  if (error) {
    console.error("deleteInvoiceItem failed:", error);
    return { error: businessRuleMessage(error) };
  }
  if (!data || data.length === 0) return { error: "Item not found. Medicine items cannot be removed because the stock was already reduced." };

  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  redirect(`/billing/${invoiceId}?msg=item_removed`);
}

// Record a payment. The database checks the balance, updates the invoice and locks the record.
export async function recordPaymentAction(invoiceId, prevState, formData) {
  await requireRole(FRONT_DESK);
  if (!UUID_REGEX.test(invoiceId)) return { error: "Invalid invoice." };

  const values = formDataToObject(formData, PAYMENT_FIELDS);
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { error } = await createPayment({
    invoice_id: invoiceId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference_no: nullIfEmpty(parsed.data.reference_no),
  });
  if (error) {
    console.error("createPayment failed:", error);
    return { error: businessRuleMessage(error), values };
  }
  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  return { success: "Payment recorded.", at: Date.now() };
}

// Dispense a prescription onto an invoice: one database transaction
// (stock - qty, invoice item added, prescription locked).
export async function dispenseAction(invoiceId, prescriptionId, prevState) {
  await requireRole(FRONT_DESK);
  if (!UUID_REGEX.test(invoiceId) || !UUID_REGEX.test(prescriptionId)) return { error: "Invalid request." };

  const { error } = await dispensePrescription(prescriptionId, invoiceId);
  if (error) {
    console.error("dispense failed:", error);
    return { error: businessRuleMessage(error) };
  }
  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/medicines");
  redirect(`/billing/${invoiceId}?msg=dispensed`);
}

// Void an invoice (admin only; not possible after a payment).
export async function voidInvoiceAction(invoiceId, prevState) {
  await requireRole([ROLES.ADMIN]);
  if (!UUID_REGEX.test(invoiceId)) return { error: "Invalid invoice." };

  const { error } = await voidInvoice(invoiceId);
  if (error) {
    console.error("voidInvoice failed:", error);
    return { error: businessRuleMessage(error) };
  }
  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  redirect(`/billing/${invoiceId}?msg=voided`);
}
