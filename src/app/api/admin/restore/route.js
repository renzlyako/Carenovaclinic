import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { ROLES } from "@/lib/constants/roles";
import { logAuditEvent } from "@/lib/audit/log";
import { parseBackup, MAX_BACKUP_BYTES } from "@/lib/utils/backup";
import { restoreBackup } from "@/services/backup.service";

export async function POST(request) {
  const { user, error } = await requireApiRole([ROLES.ADMIN]);
  if (error) return error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !file || typeof file === "string") {
    return NextResponse.json({ error: "Please choose a backup file." }, { status: 400 });
  }
  if (String(form.get("confirm") ?? "").trim() !== "RESTORE") {
    return NextResponse.json({ error: "Type RESTORE to confirm." }, { status: 400 });
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "The file is too large (maximum 10 MB)." }, { status: 400 });
  }

  const parsed = parseBackup(await file.text());
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error: dbError } = await restoreBackup(parsed.tables);
  if (dbError) {
    console.error("restore failed:", dbError);

    const known = dbError.code === "P0001" && dbError.message;
    return NextResponse.json(
      { error: known ? dbError.message : "The restore failed. No data was changed." },
      { status: 400 }
    );
  }

  await logAuditEvent({
    userId: user.id, userEmail: user.email, action: "RESTORE",
    details: { file: String(file.name).slice(0, 120), backup_created_at: parsed.createdAt, restored: data?.restored ?? parsed.counts },
  });
  return NextResponse.json({ ok: true, restored: data?.restored ?? parsed.counts });
}
