import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createDraftAgreement,
  getUserByEmail,
  getAgreementById,
  shapeAgreement,
  mapAgreementRouteError,
} from "../_lib";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const description = body?.description ? String(body.description) : null;
    const amount = Number(body?.amount || 0);
    const currency = String(body?.currency || "PUSD").trim() || "PUSD";
    const status = String(body?.status || "DRAFT").trim() || "DRAFT";
    const dueDate = String(body?.dueDate || "").trim();
    const creatorId = String(body?.creatorId || "").trim();
    const receiverEmail = String(body?.receiverEmail || "").trim().toLowerCase();
    const receiverAddress = body?.receiverAddress ? String(body.receiverAddress).trim() : null;
    const milestones = Array.isArray(body?.milestones) ? body.milestones : [];

    if (!title || !creatorId || !receiverEmail || !dueDate || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "title, creatorId, receiverEmail, amount and dueDate are required" },
        { status: 400 },
      );
    }

    if (creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!milestones.length) {
      return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
    }

    const normalizedMilestones: Array<{
      title: string;
      description: string | null;
      amount: number;
      dueDate: string | null;
      order: number;
      status: string;
    }> = milestones.map((milestone: any, index: number) => ({
      title: String(milestone?.title || "").trim(),
      description: milestone?.description ? String(milestone.description) : null,
      amount: Number(milestone?.amount || 0),
      dueDate: milestone?.dueDate ? String(milestone.dueDate) : null,
      order: Number.isFinite(Number(milestone?.order)) ? Number(milestone.order) : index,
      status: String(milestone?.status || "PENDING").trim() || "PENDING",
    }));

    if (normalizedMilestones.some((milestone) => !milestone.title || !Number.isFinite(milestone.amount))) {
      return NextResponse.json({ error: "Each milestone needs title and amount" }, { status: 400 });
    }

    const milestoneTotal = normalizedMilestones.reduce((sum, milestone) => sum + milestone.amount, 0);
    if (Math.abs(milestoneTotal - amount) >= 0.000001) {
      return NextResponse.json({ error: "Milestone total must match agreement total" }, { status: 400 });
    }

    const receiver = await getUserByEmail(receiverEmail);
    if (!receiver) {
      return NextResponse.json({ error: "Receiver email not found" }, { status: 404 });
    }

    const agreementId = await createDraftAgreement({
      title,
      description,
      amount,
      currency,
      status,
      dueDate,
      creatorId,
      receiverId: String(receiver.id),
      receiverAddress,
      milestones: normalizedMilestones,
    });

    const agreementRow = await getAgreementById(agreementId);
    const agreement = agreementRow ? await shapeAgreement(agreementRow) : { id: agreementId };

    return NextResponse.json({ message: "Draft agreement created", agreement });
  } catch (error: any) {
    console.error("[WebAgreementRoute] drafts POST failed:", error);
    const mapped = mapAgreementRouteError(error, "Internal server error");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
