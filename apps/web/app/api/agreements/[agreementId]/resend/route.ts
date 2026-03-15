import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getAgreementById, shapeAgreement, updateAgreementColumns } from "../../_lib";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ agreementId: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agreementId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const creatorId = String(body?.creatorId || "").trim();

    if (!creatorId) {
      return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
    }

    if (creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await getAgreementById(agreementId);
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (String(agreement.creatorId || "") !== creatorId) {
      return NextResponse.json({ error: "Only creator can resend acceptance" }, { status: 403 });
    }

    await updateAgreementColumns(
      agreementId,
      {
        status: "PENDING_ACCEPTANCE",
        updatedAt: new Date(),
      },
      ["status", "updatedAt"],
    );

    const updated = await getAgreementById(agreementId);
    return NextResponse.json({ message: "Acceptance reminder sent", agreement: updated ? await shapeAgreement(updated) : null });
  } catch (error: any) {
    console.error("[WebAgreementRoute] resend PUT failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
