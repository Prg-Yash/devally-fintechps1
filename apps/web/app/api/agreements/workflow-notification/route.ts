import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { notifyUser } from "@/lib/notification";

type WorkflowEvent =
  | "DRAFT_UPDATED"
  | "CHANGE_REQUESTED"
  | "READY_TO_FUND"
  | "ACCEPTANCE_REMINDER"
  | "PUBLISHED";

const isWorkflowEvent = (value: string): value is WorkflowEvent => {
  return [
    "DRAFT_UPDATED",
    "CHANGE_REQUESTED",
    "READY_TO_FUND",
    "ACCEPTANCE_REMINDER",
    "PUBLISHED",
  ].includes(value);
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const agreementId = String(body?.agreementId || "").trim();
    const agreementTitle = String(body?.agreementTitle || "").trim();
    const creatorId = String(body?.creatorId || "").trim();
    const creatorName = String(body?.creatorName || "Client").trim();
    const receiverId = String(body?.receiverId || "").trim();
    const receiverName = String(body?.receiverName || "Freelancer").trim();
    const event = String(body?.event || "").trim();

    if (!agreementId || !agreementTitle || !creatorId || !receiverId || !isWorkflowEvent(event)) {
      return NextResponse.json(
        {
          error:
            "agreementId, agreementTitle, creatorId, receiverId and a valid event are required",
        },
        { status: 400 },
      );
    }

    console.info(
      `[WebAgreementRoute] workflow-notification start event=${event} agreement=${agreementId}`,
    );

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000";
    const agreementLink = `${appBaseUrl.replace(/\/$/, "")}/agreements/${agreementId}`;

    if (event === "DRAFT_UPDATED") {
      await notifyUser({
        userId: receiverId,
        title: "Agreement draft updated",
        message: `${creatorName} updated \"${agreementTitle}\". Please review the latest version.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Agreement draft updated",
        emailActionUrl: agreementLink,
        emailActionLabel: "Review Draft Agreement",
      });
    }

    if (event === "CHANGE_REQUESTED") {
      await notifyUser({
        userId: creatorId,
        title: "Freelancer requested agreement changes",
        message: `${receiverName} requested updates on \"${agreementTitle}\". Open the agreement to respond.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Action needed on your draft agreement",
      });
    }

    if (event === "READY_TO_FUND") {
      await notifyUser({
        userId: creatorId,
        title: "Agreement approved by freelancer",
        message: `${receiverName} approved \"${agreementTitle}\". You can now publish and fund escrow.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Agreement approved and ready to fund",
      });
    }

    if (event === "ACCEPTANCE_REMINDER") {
      await notifyUser({
        userId: receiverId,
        title: "Agreement review reminder",
        message: `${creatorName} asked you to review \"${agreementTitle}\" and confirm when ready.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Reminder to review agreement draft",
      });

      await notifyUser({
        userId: creatorId,
        title: "Acceptance reminder sent",
        message: `A review reminder for \"${agreementTitle}\" was sent to ${receiverName}.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Freelancer reminder sent",
      });
    }

    if (event === "PUBLISHED") {
      await notifyUser({
        userId: receiverId,
        title: "Agreement published and funded",
        message: `${creatorName} published \"${agreementTitle}\". Your escrow agreement is now active.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Agreement is now active",
      });

      await notifyUser({
        userId: creatorId,
        title: "Agreement published successfully",
        message: `\"${agreementTitle}\" is now published and active in escrow.`,
        type: "AGREEMENT",
        entityType: "agreement",
        entityId: agreementId,
        emailSubject: "Devally: Agreement published",
      });
    }

    console.info(
      `[WebAgreementRoute] workflow-notification dispatched event=${event} agreement=${agreementId}`,
    );

    return NextResponse.json({ message: "Workflow notifications sent" });
  } catch (error: any) {
    console.error("[WebAgreementRoute] workflow-notification POST failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
