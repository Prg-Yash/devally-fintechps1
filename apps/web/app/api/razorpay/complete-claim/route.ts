import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { INR_TO_PCC_RATE, mintPccToWallet } from "@/lib/pcc-distributor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { orderId, walletAddress } = await req.json();

    console.log("[PCC_CLAIM] Incoming claim request", {
      orderId,
      walletAddress,
    });

    if (!orderId || !walletAddress) {
      return NextResponse.json({ error: "orderId and walletAddress are required" }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid walletAddress format" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({ where: { razorpayOrderId: orderId } });
    if (!purchase) {
      console.error("[PCC_CLAIM] Purchase not found", { orderId });
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.status === "COMPLETED") {
      console.log("[PCC_CLAIM] Already completed", {
        orderId,
        walletAddress,
      });
      return NextResponse.json({ message: "Already claimed" });
    }

    const pccAmount = purchase.amount * INR_TO_PCC_RATE;
    console.log("[PCC_CLAIM] Preparing mint", {
      orderId,
      walletAddress,
      purchaseAmountInr: purchase.amount,
      conversionRate: INR_TO_PCC_RATE,
      pccAmount,
      purchaseStatus: purchase.status,
    });

    const txHash = await mintPccToWallet(walletAddress as `0x${string}`, pccAmount);

    console.log("[PCC_CLAIM] Mint successful", {
      orderId,
      walletAddress,
      pccAmount,
      txHash,
    });

    await prisma.purchase.update({
      where: { razorpayOrderId: orderId },
      data: {
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      message: "Claim completed and PCC minted",
      txHash,
      mintedTo: walletAddress,
      mintedPccAmount: pccAmount,
    });
  } catch (error: any) {
    console.error("[PCC_CLAIM] Claim failed", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
