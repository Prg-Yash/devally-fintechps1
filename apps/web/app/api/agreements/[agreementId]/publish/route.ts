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
    const transactionHash = String(body?.transactionHash || "").trim();
    const receiverAddress = String(body?.receiverAddress || "").trim();
    const projectId = Number(body?.projectId || 0);

    if (!creatorId || !transactionHash || !receiverAddress || !Number.isFinite(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: "creatorId, projectId, transactionHash and receiverAddress are required" },
        { status: 400 },
      );
    }

    if (creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await getAgreementById(agreementId);
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (String(agreement.creatorId || "") !== creatorId) {
      return NextResponse.json({ error: "Only creator can publish" }, { status: 403 });
    }

    await updateAgreementColumns(
      agreementId,
      {
        projectId,
        transactionHash,
        receiverAddress,
        fundingError: null,
        status: "ACTIVE",
        updatedAt: new Date(),
      },
      ["projectId", "transactionHash", "receiverAddress", "fundingError", "status", "updatedAt"],
    );

    const updated = await getAgreementById(agreementId);
    return NextResponse.json({ message: "Agreement published", agreement: updated ? await shapeAgreement(updated) : null });
  } catch (error: any) {
    console.error("[WebAgreementRoute] publish PUT failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
