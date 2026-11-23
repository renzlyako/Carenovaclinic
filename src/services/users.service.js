import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/constants/roles";



const PROFILE_COLUMNS = "id, full_name, role, is_active, created_at, doctors(id, specialization, license_no)";


function friendly(error, fallback) {
  const msg = error?.message ?? "";
  if (/last active admin/i.test(msg)) return "You cannot remove, demote or deactivate the last active admin.";
  if (error?.code === "23505" || /license_no|duplicate key/i.test(msg)) return "That license number is already used by another doctor.";
  if (error?.code === "email_exists" || /already (been )?registered|already exists/i.test(msg)) return "An account with this email already exists.";
  if (/password/i.test(msg) && /weak|short|least|characters/i.test(msg)) return msg;
  return fallback;
}

const doctorOf = (p) => (Array.isArray(p?.doctors) ? p.doctors[0] : p?.doctors) ?? null;


export async function listUsers() {
  const admin = createAdminClient();
  const [{ data: profiles, error }, { data: authData, error: authErr }] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLUMNS).order("created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  if (error) throw new Error(error.message);
  if (authErr) throw new Error(authErr.message);

  const emails = new Map(authData.users.map((u) => [u.id, u.email]));
  return (profiles ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? null, doctor: doctorOf(p) }));
}

export async function getUser(id) {
  const admin = createAdminClient();
  const { data: p, error } = await admin.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return null;
  const { data: au } = await admin.auth.admin.getUserById(id);
  return { ...p, email: au?.user?.email ?? null, doctor: doctorOf(p) };
}


export async function createUser({ full_name, email, password, role, specialization, license_no }) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: { role }, 
  });
  if (error) return { error: friendly(error, "Could not create the account.") };

  const id = data.user.id;
  if (role === ROLES.DOCTOR) {
    const { error: docErr } = await admin.from("doctors").insert({ profile_id: id, specialization, license_no });
    if (docErr) {

      await admin.auth.admin.deleteUser(id);
      return { error: friendly(docErr, "Could not save the doctor details."), rawError: docErr };
    }
  }
  return { data: { id } };
}


export async function updateUser(id, actorId, { full_name, role, specialization, license_no }) {
  const admin = createAdminClient();
  const current = await getUser(id);
  if (!current) return { error: "User not found." };

  if (role !== current.role) {
    if (id === actorId) return { error: "You cannot change your own role." };
    if (current.doctor) {
      return { error: "A doctor's role cannot be changed because appointments are linked to the doctor record. Disable the account instead." };
    }
  }

  const { error: pErr } = await admin.from("profiles").update({ full_name, role }).eq("id", id);
  if (pErr) return { error: friendly(pErr, "Could not update the user."), rawError: pErr };

  if (role === ROLES.DOCTOR) {
    const q = current.doctor
      ? admin.from("doctors").update({ specialization, license_no }).eq("profile_id", id)
      : admin.from("doctors").insert({ profile_id: id, specialization, license_no });
    const { error: dErr } = await q;
    if (dErr) {
      if (role !== current.role) await admin.from("profiles").update({ role: current.role }).eq("id", id); // revert
      return { error: friendly(dErr, "Could not save the doctor details."), rawError: dErr };
    }
  }
  return { data: { before: { full_name: current.full_name, role: current.role }, after: { full_name, role } } };
}

export async function setUserActive(id, actorId, active) {
  if (id === actorId && !active) return { error: "You cannot disable your own account." };
  const admin = createAdminClient();

  const { data, error } = await admin.from("profiles").update({ is_active: active }).eq("id", id).select("id");
  if (error) return { error: friendly(error, "Could not update the account."), rawError: error };
  if (!data?.length) return { error: "User not found." };

  const { error: banErr } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  if (banErr) {
    await admin.from("profiles").update({ is_active: !active }).eq("id", id); // revert
    return { error: "Could not update the login status. Please try again.", rawError: banErr };
  }
  return { data: { id } };
}

export async function resetUserPassword(id, password) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: friendly(error, "Could not reset the password."), rawError: error };
  return { data: { id } };
}
