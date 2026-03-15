import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ agreementId: string }>;
};

type VerifierCriterion = {
  score?: number;
  comment?: string;
};

type VerifierResponse = {
  confidence_score?: number;
  client_decision_required?: boolean;
  requirements_met?: string[];
  requirements_missing?: string[];
  per_criterion?: Record<string, VerifierCriterion>;
  summary?: string;
};

const db = prisma as any;
const AI_BASE_URL =
  process.env.AI_AGENTS_BASE_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || "http://localhost:8000";

const hasMilestoneSubmissionDelegate = () => {
  return Boolean(db?.milestoneSubmission && typeof db.milestoneSubmission.create === "function");
};

const normalizeUrlOrEmpty = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const isSchemaMissingError = (error: any) => {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";
  return code === "P2021" || message.toLowerCase().includes("milestone_submission");
};

const shapeSubmission = (row: any) => ({
  id: String(row.id),
  agreementId: String(row.agreementId),
  milestoneId: String(row.milestoneId),
  submittedById: String(row.submittedById),
  imageUrl: row.imageUrl || null,
  supportingLink: row.supportingLink || null,
  verificationUrl: String(row.verificationUrl || ""),
  confidenceScore: Number(row.confidenceScore || 0),
  clientDecisionRequired: Boolean(row.clientDecisionRequired),
  requirementsMet: Array.isArray(row.requirementsMet) ? row.requirementsMet : [],
  requirementsMissing: Array.isArray(row.requirementsMissing) ? row.requirementsMissing : [],
  perCriterion: row.perCriterion && typeof row.perCriterion === "object" ? row.perCriterion : {},
  summary: row.summary || "",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

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

    const agreement = await db.agreement.findUnique({
      where: { id: agreementId },
      select: { id: true, creatorId: true, receiverId: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (session.user.id !== String(agreement.creatorId) && session.user.id !== String(agreement.receiverId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!db?.milestoneSubmission || typeof db.milestoneSubmission.findMany !== "function") {
      return NextResponse.json(
        {
          submissions: [],
          latestByMilestone: {},
          schemaReady: true,
          clientReady: false,
          error:
            "Prisma client is stale in apps/web runtime. Restart apps/web after running `npx prisma generate` in packages/db.",
          code: "DB_CLIENT_OUTDATED",
        },
        { status: 503 },
      );
    }

    let rows: any[] = [];
    try {
      rows = await db.milestoneSubmission.findMany({
        where: { agreementId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      if (!isSchemaMissingError(error)) {
        throw error;
      }
      return NextResponse.json({ submissions: [], latestByMilestone: {}, schemaReady: false });
    }

    const submissions = rows.map(shapeSubmission);
    const latestByMilestone = submissions.reduce((acc: Record<string, any>, submission: any) => {
      if (!acc[submission.milestoneId]) {
        acc[submission.milestoneId] = submission;
      }
      return acc;
    }, {});

    return NextResponse.json({ submissions, latestByMilestone, schemaReady: true });
  } catch (error: any) {
    console.error("[WebAgreementMilestoneSubmissionRoute] GET failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agreementId } = await context.params;
    if (!agreementId) {
      return NextResponse.json({ error: "agreementId is required" }, { status: 400 });
    }

    const agreement = await db.agreement.findUnique({
      where: { id: agreementId },
      select: { id: true, creatorId: true, receiverId: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    const freelancerId = String(agreement.receiverId || "");
    if (session.user.id !== freelancerId) {
      return NextResponse.json({ error: "Only assigned freelancer can submit milestone deliverables" }, { status: 403 });
    }

    if (!hasMilestoneSubmissionDelegate()) {
      return NextResponse.json(
        {
          error:
            "Prisma client is stale in apps/web runtime. Run `npx prisma generate` in packages/db and restart apps/web dev server.",
          code: "DB_CLIENT_OUTDATED",
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const milestoneId = String(body?.milestoneId || "").trim();
    const imageUrl = normalizeUrlOrEmpty(body?.imageUrl);
    const supportingLink = normalizeUrlOrEmpty(body?.supportingLink);

    if (!milestoneId) {
      return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
    }

    if (!imageUrl && !supportingLink) {
      return NextResponse.json({ error: "Provide at least one valid URL: imageUrl or supportingLink" }, { status: 400 });
    }

    const milestone = await db.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, agreementId: true, title: true, description: true },
    });

    if (!milestone || String(milestone.agreementId) !== agreementId) {
      return NextResponse.json({ error: "Milestone not found for agreement" }, { status: 404 });
    }

    const verificationUrl = supportingLink || imageUrl;
    const milestoneSpec = [milestone.title, milestone.description].filter(Boolean).join("\n\n").trim();

    const verifierRes = await fetch(`${AI_BASE_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: verificationUrl,
        milestone_spec: milestoneSpec || milestone.title || "Milestone deliverable",
        contract_id: agreementId,
        milestone_id: milestoneId,
      }),
      cache: "no-store",
    });

    const verifierData = (await verifierRes.json().catch(() => ({}))) as VerifierResponse;
    if (!verifierRes.ok) {
      return NextResponse.json(
        {
          error:
            (verifierData as any)?.error ||
            `Verifier request failed (${verifierRes.status}). Check AI agent service availability.`,
        },
        { status: 502 },
      );
    }

    let created: any;
    try {
      created = await db.milestoneSubmission.create({
        data: {
          agreementId,
          milestoneId,
          submittedById: session.user.id,
          imageUrl: imageUrl || null,
          supportingLink: supportingLink || null,
          verificationUrl,
          confidenceScore: Number(verifierData?.confidence_score || 0),
          clientDecisionRequired: Boolean(
            verifierData?.client_decision_required === undefined ? true : verifierData.client_decision_required,
          ),
          requirementsMet: Array.isArray(verifierData?.requirements_met) ? verifierData.requirements_met : [],
          requirementsMissing: Array.isArray(verifierData?.requirements_missing)
            ? verifierData.requirements_missing
            : [],
          perCriterion:
            verifierData?.per_criterion && typeof verifierData.per_criterion === "object"
              ? verifierData.per_criterion
              : {},
          summary: String(verifierData?.summary || ""),
        },
      });
    } catch (error: any) {
      if (isSchemaMissingError(error)) {
        return NextResponse.json(
          {
            error:
              "Database schema is missing milestone_submission table. Run Prisma migration or db push for packages/db.",
            code: "DB_SCHEMA_OUTDATED",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({ submission: shapeSubmission(created) }, { status: 201 });
  } catch (error: any) {
    console.error("[WebAgreementMilestoneSubmissionRoute] POST failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
