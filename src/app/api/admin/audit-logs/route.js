import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { ROLES } from "@/lib/constants/roles";
import { auditQuerySchema } from "@/lib/validators/audit";
import { listAuditLogs, AUDIT_PAGE_SIZE } from "@/services/audit.service";

// GET /api/admin/audit-logs?page=1&action=LOGIN&user=ana&table=patients&from=2026-11-01&to=2026-11-30
// READ-ONLY and admin only. There is no POST / PATCH / DELETE on purpose: the audit trail cannot be changed.
export async function GET(request) {
  const { error } = await requireApiRole([ROLES.ADMIN]);
  if (error) return error;

  const sp = new URL(request.url).searchParams;
  const parsed = auditQuerySchema.safeParse({
    user: sp.get("user") ?? "", action: sp.get("action") ?? "", table: sp.get("table") ?? "",
    from: sp.get("from") ?? "", to: sp.get("to") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  try {
    const { data, count } = await listAuditLogs({ ...parsed.data, page });
    return NextResponse.json({ data, count, pageSize: AUDIT_PAGE_SIZE });
  } catch (e) {
    console.error("GET /api/admin/audit-logs failed:", e);
    return NextResponse.json({ error: "Could not load the audit logs" }, { status: 500 });
  }
}
