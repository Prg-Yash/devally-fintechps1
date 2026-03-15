import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseUnits } from "viem";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const INR_TO_PCC_RATE = Number(
  process.env.INR_TO_PCC_RATE ?? process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1",
);

const FUNDING_PURCHASE_STATUSES = ["PAYMENT_VERIFIED", "CLAIMABLE", "COMPLETED"] as const;
const WITHDRAW_COMPLETED_STATUS = "COMPLETED";
const WITHDRAW_DECIMALS = 6;
const SIM_BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const INTERNAL_TOKEN_POOL = "PUSD_LEDGER_POOL";
const INTERNAL_SETTLEMENT_ACCOUNT = "INR_SETTLEMENT_SIM";

type ClaimablePurchase = {
  id: string;
  amount: number;
};

function roundPcc(value: number) {
  return Number(value.toFixed(WITHDRAW_DECIMALS));
}

function toPccFromInr(inrAmount: number) {
  return roundPcc(inrAmount * INR_TO_PCC_RATE);
}

function getClaimablePcc(purchases: ClaimablePurchase[]) {
  const total = purchases.reduce((sum, purchase) => sum + toPccFromInr(purchase.amount), 0);
  return roundPcc(total);
}

async function getAuthenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

async function getClaimablePurchases(userId: string) {
  return prisma.purchase.findMany({
    where: {
      userId,
      status: {
        in: [...FUNDING_PURCHASE_STATUSES],
      },
    },
    select: {
      id: true,
      amount: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

function toInrFromPcc(pccAmount: number) {
  if (!Number.isFinite(pccAmount)) return 0;
  if (INR_TO_PCC_RATE <= 0) return roundPcc(pccAmount);
  return roundPcc(pccAmount / INR_TO_PCC_RATE);
}

function createSimulationTxHash() {
  const ts = Date.now().toString(16).padStart(12, "0");
  const rnd = Math.random().toString(16).slice(2).padEnd(52, "0").slice(0, 52);
  return `0x${ts}${rnd}`;
}

function computeStats(withdrawals: Array<{ amountPcc: number; status: string; createdAt: Date | string }>) {
  const completed = withdrawals.filter((w) => w.status === WITHDRAW_COMPLETED_STATUS);
  const totalWithdrawnPcc = roundPcc(completed.reduce((sum, w) => sum + Number(w.amountPcc || 0), 0));
  const totalWithdrawnInr = toInrFromPcc(totalWithdrawnPcc);

  const averageWithdrawalInr = completed.length > 0 ? Number((totalWithdrawnInr / completed.length).toFixed(2)) : 0;
  const largestWithdrawalInr = completed.length > 0
    ? Math.max(...completed.map((w) => toInrFromPcc(Number(w.amountPcc || 0))))
    : 0;

  const now = new Date();
  const thisMonthCompleted = completed.filter((w) => {
    const d = new Date(w.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthWithdrawnInr = Number(
    thisMonthCompleted
      .reduce((sum, w) => sum + toInrFromPcc(Number(w.amountPcc || 0)), 0)
      .toFixed(2),
  );

  return {
    completedCount: completed.length,
    totalWithdrawnPcc,
    totalWithdrawnInr,
    averageWithdrawalInr,
    largestWithdrawalInr,
    thisMonthWithdrawnInr,
    thisMonthWithdrawalCount: thisMonthCompleted.length,
  };
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [withdrawals, claimablePurchases] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      getClaimablePurchases(userId),
    ]);

    const purchasedPcc = getClaimablePcc(claimablePurchases);
    const stats = computeStats(withdrawals as any);
    const claimablePcc = roundPcc(Math.max(0, purchasedPcc - stats.totalWithdrawnPcc));
    const claimableInr = toInrFromPcc(claimablePcc);

    const normalizedWithdrawals = withdrawals.map((w) => ({
      ...w,
      fromAddress: INTERNAL_TOKEN_POOL,
      burnAddress: SIM_BURN_ADDRESS,
      toWalletAddress: INTERNAL_SETTLEMENT_ACCOUNT,
      toUserAccount: w.userId,
      amountInr: toInrFromPcc(Number(w.amountPcc || 0)),
    }));

    return NextResponse.json({
      withdrawals: normalizedWithdrawals,
      summary: {
        claimablePcc,
        claimableInr,
        totalWithdrawnPcc: stats.totalWithdrawnPcc,
        totalWithdrawnInr: stats.totalWithdrawnInr,
        averageWithdrawalInr: stats.averageWithdrawalInr,
        largestWithdrawalInr: stats.largestWithdrawalInr,
        thisMonthWithdrawnInr: stats.thisMonthWithdrawnInr,
        thisMonthWithdrawalCount: stats.thisMonthWithdrawalCount,
        conversionRate: INR_TO_PCC_RATE,
        completedCount: stats.completedCount,
        pendingCount: withdrawals.filter((withdrawal) => withdrawal.status === "PENDING").length,
        failedCount: withdrawals.filter((withdrawal) => withdrawal.status === "FAILED").length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedAmountRaw = body?.amountPcc;

    const claimablePurchases = await getClaimablePurchases(userId);
    const previousWithdrawals = await prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const purchasedPcc = getClaimablePcc(claimablePurchases);
    const stats = computeStats(previousWithdrawals as any);
    const claimablePcc = roundPcc(Math.max(0, purchasedPcc - stats.totalWithdrawnPcc));

    if (claimablePcc <= 0) {
      return NextResponse.json(
        { error: "No claimable PCC balance available for withdrawal." },
        { status: 400 },
      );
    }

    const parsedAmount =
      typeof requestedAmountRaw === "number"
        ? requestedAmountRaw
        : typeof requestedAmountRaw === "string"
          ? Number(requestedAmountRaw)
          : claimablePcc;

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "amountPcc must be a valid number greater than zero." },
        { status: 400 },
      );
    }

    const amountPcc = roundPcc(parsedAmount);

    if (amountPcc > claimablePcc) {
      return NextResponse.json(
        {
          error: "Requested amount exceeds claimable balance.",
          claimablePcc,
        },
        { status: 400 },
      );
    }

    const amountBaseUnits = parseUnits(amountPcc.toFixed(WITHDRAW_DECIMALS), WITHDRAW_DECIMALS).toString();

    const pendingWithdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        walletAddress: INTERNAL_SETTLEMENT_ACCOUNT,
        amountPcc,
        amountBaseUnits,
        status: "PENDING",
      },
    });

    try {
      const txHash = createSimulationTxHash();

      const completedWithdrawal = await prisma.$transaction(async (tx) => {
        return tx.withdrawal.update({
          where: { id: pendingWithdrawal.id },
          data: {
            status: WITHDRAW_COMPLETED_STATUS,
            txHash,
            failureReason: null,
          },
        });
      });

      return NextResponse.json({
        message: "Withdrawal simulation completed successfully.",
        withdrawal: {
          ...completedWithdrawal,
          fromAddress: INTERNAL_TOKEN_POOL,
          burnAddress: SIM_BURN_ADDRESS,
          toWalletAddress: INTERNAL_SETTLEMENT_ACCOUNT,
          toUserAccount: completedWithdrawal.userId,
          amountInr: toInrFromPcc(Number(completedWithdrawal.amountPcc || 0)),
        },
      });
    } catch (error: any) {
      const failureReason = String(error?.message || "Token transfer failed").slice(0, 1000);

      const failedWithdrawal = await prisma.withdrawal.update({
        where: { id: pendingWithdrawal.id },
        data: {
          status: "FAILED",
          failureReason,
        },
      });

      return NextResponse.json(
        {
          error: failureReason,
          withdrawal: failedWithdrawal,
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
