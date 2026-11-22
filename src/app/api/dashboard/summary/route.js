import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/services/dashboard.service";

// GET /api/dashboard/summary -> KPIs + chart data (what the dashboard shows, filtered by the user's role)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    return NextResponse.json({ data: await getDashboardData(user.role) });
  } catch (e) {
    console.error("GET /api/dashboard/summary failed:", e);
    return NextResponse.json({ error: "Could not load the dashboard" }, { status: 500 });
  }
}
