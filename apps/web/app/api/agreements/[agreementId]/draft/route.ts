import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { mapAgreementRouteError } from "../../_lib";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ agreementId: string }>;
};

type NormalizedMilestone = {
  title: string;
  description: string | null;
  amount: number;
  dueDate: Date | null;
  order: number;
  status: string;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agreementId } = await context.params;
    if (!agreementId) {
      return NextResponse.json({ error: "agreementId is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const creatorId = String(body?.creatorId || "").trim();
    const title = String(body?.title || "").trim();
    const description = body?.description ? String(body.description) : null;
    const amount = Number(body?.amount || 0);
    const currency = String(body?.currency || "PUSD").trim() || "PUSD";
    const dueDate = body?.dueDate ? String(body.dueDate).trim() : null;
    const status = String(body?.status || "NEGOTIATING").trim() || "NEGOTIATING";
    const milestones = Array.isArray(body?.milestones) ? body.milestones : [];

    if (!creatorId || !title || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
      return NextResponse.json(
        { error: "creatorId, title, amount and dueDate are required" },
        { status: 400 },
      );
    }

    if (creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!milestones.length) {
      return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
    }

    const normalizedMilestones: NormalizedMilestone[] = milestones.map((milestone: any, index: number) => ({
      title: String(milestone?.title || "").trim(),
      description: milestone?.description ? String(milestone.description) : null,
      amount: Number(milestone?.amount || 0),
      dueDate: milestone?.dueDate ? new Date(String(milestone.dueDate)) : null,
      order: Number.isFinite(Number(milestone?.order)) ? Number(milestone.order) : index,
      status: String(milestone?.status || "PENDING").trim() || "PENDING",
    }));

    if (normalizedMilestones.some((milestone) => !milestone.title || !Number.isFinite(milestone.amount))) {
      return NextResponse.json(
        { error: "Each milestone must include a valid title and amount" },
        { status: 400 },
      );
    }

    const milestoneTotal = normalizedMilestones.reduce((sum, milestone) => sum + milestone.amount, 0);
    if (Math.abs(milestoneTotal - amount) >= 0.000001) {
      return NextResponse.json(
        { error: "Milestone total must match agreement total" },
        { status: 400 },
      );
    }

    const db = prisma as any;

    const existing = await db.agreement.findUnique({
      where: { id: agreementId },
      select: { id: true, creatorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (String(existing.creatorId) !== creatorId) {
      return NextResponse.json({ error: "Only creator can update draft" }, { status: 403 });
    }

    await db.$transaction(async (tx: any) => {
      await tx.agreement.update({
        where: { id: agreementId },
        data: {
          title,
          description,
          amount,
          currency,
          status,
          dueDate: new Date(dueDate),
        },
      });

      await tx.milestone.deleteMany({
        where: { agreementId },
      });

      if (tx.milestone.createMany) {
        await tx.milestone.createMany({
          data: normalizedMilestones.map((milestone) => ({
            id: randomUUID(),
            agreementId,
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            dueDate: milestone.dueDate,
            order: milestone.order,
            status: milestone.status,
          })),
        });
      } else {
        for (const milestone of normalizedMilestones) {
          await tx.milestone.create({
            data: {
              id: randomUUID(),
              agreementId,
              title: milestone.title,
              description: milestone.description,
              amount: milestone.amount,
              dueDate: milestone.dueDate,
              order: milestone.order,
              status: milestone.status,
            },
          });
        }
      }
    });

    console.info(`[WebAgreementRoute] Draft updated via Next.js API agreement=${agreementId} creator=${creatorId}`);

    return NextResponse.json({
      message: "Draft updated",
      agreement: { id: agreementId },
    });
  } catch (error: any) {
    console.error("[WebAgreementRoute] draft PUT failed:", error);
    const mapped = mapAgreementRouteError(error, "Internal server error");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
