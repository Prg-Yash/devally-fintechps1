import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notification";

export const runtime = "nodejs";

type ExistingNotificationRow = {
  id: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const agreementId = String(body?.agreementId || "").trim();
    const receiverId = String(body?.receiverId || "").trim();
    const agreementTitle = String(body?.agreementTitle || "").trim();
    const creatorEmail = String(body?.creatorEmail || session.user.email || "").trim();

    if (!agreementId || !receiverId || !agreementTitle) {
      return NextResponse.json(
        { error: "agreementId, receiverId and agreementTitle are required" },
        { status: 400 },
      );
    }

    const alreadyExists = await prisma.$queryRaw<ExistingNotificationRow[]>`
      SELECT "id"
      FROM "notification"
      WHERE "userId" = ${receiverId}
        AND "type" = 'AGREEMENT'
        AND "entityType" = 'agreement'
        AND "entityId" = ${agreementId}
      LIMIT 1
    `;

    if (alreadyExists.length > 0) {
      return NextResponse.json({ message: "Notification already exists", deduped: true });
    }

    await notifyUser({
      userId: receiverId,
      title: "New agreement draft received",
      message: `You received draft "${agreementTitle}" from ${creatorEmail}.`,
      type: "AGREEMENT",
      entityType: "agreement",
      entityId: agreementId,
      emailSubject: "Devally: New draft agreement pending your review",
    });

    return NextResponse.json({ message: "Draft notification dispatched", deduped: false });
  } catch (error: any) {
    console.error("[WebAgreementRoute] draft-notification POST failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}