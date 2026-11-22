import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { ROLES } from "@/lib/constants/roles";
import { logAuditEvent } from "@/lib/audit/log";
import { UUID_REGEX } from "@/lib/utils/forms";
import { setUserActive } from "@/services/users.service";

// PATCH /api/admin/users/:id -> enable / disable the account
// (name, role and doctor details are edited from the Users screen)
export async function PATCH(request, { params }) {
  const { user, error } = await requireApiRole([ROLES.ADMIN]);
  if (error) return error;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: "Invalid user" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (typeof body?.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active (true/false) is required" }, { status: 400 });
  }

  const { error: updError, rawError } = await setUserActive(id, user.id, body.is_active);
  if (updError) {
    if (rawError) console.error("setUserActive failed:", rawError);
    return NextResponse.json({ error: updError }, { status: 400 });
  }

  await logAuditEvent({
    userId: user.id, userEmail: user.email,
    action: body.is_active ? "ADMIN_ENABLE_USER" : "ADMIN_DISABLE_USER",
    details: { target_user: id },
  });
  return NextResponse.json({ ok: true });
}
