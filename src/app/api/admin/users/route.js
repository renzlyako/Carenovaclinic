import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { ROLES } from "@/lib/constants/roles";
import { logAuditEvent } from "@/lib/audit/log";
import { userCreateSchema } from "@/lib/validators/user";
import { listUsers, createUser } from "@/services/users.service";

// GET /api/admin/users  -> list of users (admin only)
export async function GET() {
  const { error } = await requireApiRole([ROLES.ADMIN]);
  if (error) return error;
  try {
    return NextResponse.json({ data: await listUsers() });
  } catch (e) {
    console.error("GET /api/admin/users failed:", e);
    return NextResponse.json({ error: "Could not load users" }, { status: 500 });
  }
}

// POST /api/admin/users  -> create a new account (admin only)
export async function POST(request) {
  const { user, error } = await requireApiRole([ROLES.ADMIN]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const input = {
    full_name: String(body?.full_name ?? "").trim(),
    email: String(body?.email ?? "").trim().toLowerCase(),
    password: String(body?.password ?? ""),
    role: body?.role,
    specialization: String(body?.specialization ?? "").trim(),
    license_no: String(body?.license_no ?? "").trim(),
  };
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { data, error: createError, rawError } = await createUser(parsed.data);
  if (createError) {
    if (rawError) console.error("createUser failed:", rawError);
    return NextResponse.json({ error: createError }, { status: 400 });
  }

  await logAuditEvent({
    userId: user.id, userEmail: user.email, action: "ADMIN_CREATE_USER",
    details: { target_user: data.id, email: parsed.data.email, role: parsed.data.role },
  });
  return NextResponse.json({ data: { id: data.id } }, { status: 201 });
}
