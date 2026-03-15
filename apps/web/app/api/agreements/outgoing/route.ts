import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { listAgreementsByRole } from "../_lib";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get("userId")?.trim() || session.user.id;
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreements = await listAgreementsByRole({ userId, role: "outgoing" });
    return NextResponse.json({ agreements });
  } catch (error: any) {
    console.error("[WebAgreementRoute] outgoing GET failed:", error);
    return NextResponse.json({ agreements: [], warning: error?.message || "Fallback response" });
  }
}
