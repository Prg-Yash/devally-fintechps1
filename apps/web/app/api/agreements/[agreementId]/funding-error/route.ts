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
    const errorMessage = String(body?.errorMessage || "").trim();

    if (!creatorId || !errorMessage) {
      return NextResponse.json({ error: "creatorId and errorMessage are required" }, { status: 400 });
    }

    if (creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await getAgreementById(agreementId);
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (String(agreement.creatorId || "") !== creatorId) {
      return NextResponse.json({ error: "Only creator can update funding errors" }, { status: 403 });
    }

    await updateAgreementColumns(
      agreementId,
      {
        fundingError: errorMessage,
        updatedAt: new Date(),
      },
      ["fundingError", "updatedAt"],
    );

    const updated = await getAgreementById(agreementId);
    return NextResponse.json({ message: "Funding error recorded", agreement: updated ? await shapeAgreement(updated) : null });
  } catch (error: any) {
    console.error("[WebAgreementRoute] funding-error PUT failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
