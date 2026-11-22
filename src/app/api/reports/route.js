import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { ROLES } from "@/lib/constants/roles";
import { logAuditEvent } from "@/lib/audit/log";
import { reportQuerySchema } from "@/lib/validators/report";
import { REPORTS, runReport } from "@/services/reports.service";
import { toCsv } from "@/lib/utils/csv";

// GET /api/reports?type=daily_collection&from=2026-11-01&to=2026-11-30&format=csv
// Without format=csv the report is returned as JSON.
export async function GET(request) {
  const { user, error } = await requireApiRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);
  if (error) return error;

  const sp = new URL(request.url).searchParams;
  const parsed = reportQuerySchema.safeParse({
    type: sp.get("type") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { type, from, to } = parsed.data;
  if (!REPORTS[type].roles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let result;
  try {
    result = await runReport(type, { from, to });
  } catch (e) {
    console.error("GET /api/reports failed:", e);
    return NextResponse.json({ error: "Could not generate the report" }, { status: 500 });
  }

  if (sp.get("format") !== "csv") {
    return NextResponse.json({ data: { title: result.def.title, range: result.def.usesDates ? result.range : null, rows: result.rows } });
  }

  await logAuditEvent({
    userId: user.id, userEmail: user.email, action: "REPORT_EXPORT",
    details: { type, ...(result.def.usesDates ? result.range : {}), rows: result.rows.length },
  });

  const suffix = result.def.usesDates ? `_${result.range.from}_to_${result.range.to}` : `_${new Date().toISOString().slice(0, 10)}`;
  return new NextResponse(toCsv(result.def.columns, result.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="carenova_${type}${suffix}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
