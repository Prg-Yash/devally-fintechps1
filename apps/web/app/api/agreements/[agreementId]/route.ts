import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getAgreementById, shapeAgreement } from "../_lib";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ agreementId: string }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agreementId } = await context.params;
    if (!agreementId) {
      return NextResponse.json({ error: "agreementId is required" }, { status: 400 });
    }

    const agreementRow = await getAgreementById(agreementId);
    if (!agreementRow) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    const sessionUserId = session.user.id;
    const creatorId = String(agreementRow.creatorId || "");
    const receiverId = String(agreementRow.receiverId || "");
    if (sessionUserId !== creatorId && sessionUserId !== receiverId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await shapeAgreement(agreementRow);
    return NextResponse.json({ agreement });
  } catch (error: any) {
    console.error("[WebAgreementRoute] agreement GET failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
