"use server";

import prisma from "@/lib/prisma";

export async function markMilestonePaidAction(input: {
  agreementId: string;
  milestoneId: string;
  payoutTxHash?: string;
}) {
  const { agreementId, milestoneId, payoutTxHash } = input;

  if (!agreementId || !milestoneId) {
    throw new Error("agreementId and milestoneId are required");
  }

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone || milestone.agreementId !== agreementId) {
    throw new Error("Milestone not found for agreement");
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      payoutTxHash: payoutTxHash || null,
    },
  });

  return { success: true };
}
