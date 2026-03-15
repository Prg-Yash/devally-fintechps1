import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createChangeRequest,
  getAgreementById,
  shapeAgreement,
  updateAgreementColumns,
} from "../../_lib";

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

    const receiverId = String(body?.receiverId || "").trim();
    const note = String(body?.note || "").trim();

    if (!receiverId || !note) {
      return NextResponse.json({ error: "receiverId and note are required" }, { status: 400 });
    }

    if (receiverId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await getAgreementById(agreementId);
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (String(agreement.receiverId || "") !== receiverId) {
      return NextResponse.json({ error: "Only assigned freelancer can request changes" }, { status: 403 });
    }

    await createChangeRequest({
      agreementId,
      requestedById: receiverId,
      note,
    });

    await updateAgreementColumns(
      agreementId,
      {
        status: "NEGOTIATING",
        updatedAt: new Date(),
      },
      ["status", "updatedAt"],
    );

    const updated = await getAgreementById(agreementId);
    return NextResponse.json({ message: "Change request submitted", agreement: updated ? await shapeAgreement(updated) : null });
  } catch (error: any) {
    console.error("[WebAgreementRoute] request-changes PUT failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
