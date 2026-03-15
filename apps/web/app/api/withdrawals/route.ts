import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { parseUnits } from "viem";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { transferPccToWallet } from "@/lib/pcc-distributor";

export const runtime = "nodejs";

const INR_TO_PCC_RATE = Number(
  process.env.INR_TO_PCC_RATE ?? process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1",
);

const CLAIMABLE_PURCHASE_STATUSES = ["PAYMENT_VERIFIED", "CLAIMABLE"] as const;
const WITHDRAW_COMPLETED_STATUS = "COMPLETED";
const WITHDRAW_DECIMALS = 6;
const WITHDRAW_EPSILON = 1 / 10 ** WITHDRAW_DECIMALS;

type ClaimablePurchase = {
  id: string;
  amount: number;
};

function isWalletAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

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
        in: [...CLAIMABLE_PURCHASE_STATUSES],
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

    const claimablePcc = getClaimablePcc(claimablePurchases);
    const completedWithdrawals = withdrawals.filter(
      (withdrawal) => withdrawal.status === WITHDRAW_COMPLETED_STATUS,
    );
    const totalWithdrawnPcc = roundPcc(
      completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amountPcc, 0),
    );

    return NextResponse.json({
      withdrawals,
      summary: {
        claimablePcc,
        totalWithdrawnPcc,
        conversionRate: INR_TO_PCC_RATE,
        completedCount: completedWithdrawals.length,
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
    const walletAddressRaw =
      typeof body?.walletAddress === "string" ? body.walletAddress.trim() : "";
    const requestedAmountRaw = body?.amountPcc;

    if (!walletAddressRaw || !isWalletAddress(walletAddressRaw)) {
      return NextResponse.json(
        { error: "A valid walletAddress is required." },
        { status: 400 },
      );
    }

    const claimablePurchases = await getClaimablePurchases(userId);
    const claimablePcc = getClaimablePcc(claimablePurchases);

    if (claimablePcc <= 0 || claimablePurchases.length === 0) {
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

    // We only allow full claimable withdrawals to keep purchase accounting exact.
    if (Math.abs(amountPcc - claimablePcc) > WITHDRAW_EPSILON) {
      return NextResponse.json(
        {
          error:
            "For now, please withdraw the full claimable balance shown on screen to keep order accounting consistent.",
          claimablePcc,
        },
        { status: 400 },
      );
    }

    const amountBaseUnits = parseUnits(amountPcc.toFixed(WITHDRAW_DECIMALS), WITHDRAW_DECIMALS).toString();

    const pendingWithdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        walletAddress: walletAddressRaw,
        amountPcc,
        amountBaseUnits,
        status: "PENDING",
      },
    });

    try {
      const txHash = await transferPccToWallet(walletAddressRaw, amountPcc);

      const completedWithdrawal = await prisma.$transaction(async (tx) => {
        await tx.purchase.updateMany({
          where: {
            id: {
              in: claimablePurchases.map((purchase) => purchase.id),
            },
          },
          data: {
            status: WITHDRAW_COMPLETED_STATUS,
          },
        });

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
        message: "Withdrawal completed successfully.",
        withdrawal: completedWithdrawal,
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
