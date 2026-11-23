"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { medicineSchema, MEDICINE_FIELDS } from "@/lib/validators/medicine";
import { formDataToObject, zodFieldErrors, nullIfEmpty, UUID_REGEX } from "@/lib/utils/forms";
import { friendlyDbError } from "@/lib/utils/db-errors";
import { createMedicine, updateMedicine, deleteMedicine } from "@/services/medicines.service";

const ADMIN_ONLY = [ROLES.ADMIN];

function toRow(v) {
  return {
    name: v.name,
    description: nullIfEmpty(v.description),
    stock_qty: v.stock_qty,
    reorder_level: v.reorder_level,
    unit_price: v.unit_price,
  };
}

function medicineError(error) {
  if (error.code === "23505") return "A medicine with this name already exists.";
  return friendlyDbError(error);
}

export async function createMedicineAction(prevState, formData) {
  await requireRole(ADMIN_ONLY);
  const values = formDataToObject(formData, MEDICINE_FIELDS);
  const parsed = medicineSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { error } = await createMedicine(toRow(parsed.data));
  if (error) {
    console.error("createMedicine failed:", error);
    return { error: medicineError(error), values };
  }
  revalidatePath("/medicines");
  redirect("/medicines?msg=created");
}

export async function updateMedicineAction(id, prevState, formData) {
  await requireRole(ADMIN_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid medicine." };

  const values = formDataToObject(formData, MEDICINE_FIELDS);
  values.is_active = formData.get("is_active") === "on" ? "on" : "";
  const parsed = medicineSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error), values };

  const { data, error } = await updateMedicine(id, { ...toRow(parsed.data), is_active: values.is_active === "on" });
  if (error) {
    console.error("updateMedicine failed:", error);
    return { error: medicineError(error), values };
  }
  if (!data || data.length === 0) return { error: "Medicine not found or you do not have permission to edit it.", values };

  revalidatePath("/medicines");
  redirect("/medicines?msg=updated");
}

export async function deleteMedicineAction(id, prevState) {
  await requireRole(ADMIN_ONLY);
  if (!UUID_REGEX.test(id)) return { error: "Invalid medicine." };

  const { data, error } = await deleteMedicine(id);
  if (error) {
    console.error("deleteMedicine failed:", error);
    if (error.code === "23001" || error.code === "23503") {
      return { error: "This medicine is used in prescriptions or invoices, so it cannot be deleted. Edit it and turn off “Active” instead." };
    }
    return { error: friendlyDbError(error) };
  }
  if (!data || data.length === 0) return { error: "Medicine not found or you do not have permission to delete it." };

  revalidatePath("/medicines");
  redirect("/medicines?msg=deleted");
}
