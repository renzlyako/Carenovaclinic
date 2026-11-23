import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./guards";

export async function requireApiRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  if (!allowedRoles.includes(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}
