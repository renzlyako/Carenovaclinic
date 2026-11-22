import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { ROLES } from "@/lib/constants/roles";
import { logAuditEvent } from "@/lib/audit/log";
import { createBackup } from "@/services/backup.service";

// GET /api/admin/backup -> download a JSON backup (admin only)
export async function GET() {
  const { user, error } = await requireApiRole([ROLES.ADMIN]);
  if (error) return error;

  let backup;
  try {
    backup = await createBackup(user.email);
  } catch (e) {
    console.error("GET /api/admin/backup failed:", e);
    return NextResponse.json({ error: "Could not create the backup" }, { status: 500 });
  }

  await logAuditEvent({
    userId: user.id, userEmail: user.email, action: "BACKUP",
    details: { row_counts: backup.row_counts },
  });

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="carenova-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
