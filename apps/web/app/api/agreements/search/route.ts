import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { findAgreementByProjectId, shapeAgreement } from "../_lib";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = Number(request.nextUrl.searchParams.get("projectId") || "");
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const agreementRow = await findAgreementByProjectId(projectId);
    if (!agreementRow) {
      return NextResponse.json({ agreement: null });
    }

    const agreement = await shapeAgreement(agreementRow);
    return NextResponse.json({ agreement });
  } catch (error: any) {
    console.error("[WebAgreementRoute] search GET failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
