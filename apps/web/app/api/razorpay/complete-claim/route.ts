import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { INR_TO_PCC_RATE, mintPccToWallet } from "@/lib/pcc-distributor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { orderId, walletAddress } = await req.json();

    if (!orderId || !walletAddress) {
      return NextResponse.json({ error: "orderId and walletAddress are required" }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid walletAddress format" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({ where: { razorpayOrderId: orderId } });
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.status === "COMPLETED") {
      return NextResponse.json({ message: "Already claimed" });
    }

    const pccAmount = purchase.amount * INR_TO_PCC_RATE;
    const txHash = await mintPccToWallet(walletAddress as `0x${string}`, pccAmount);

    await prisma.purchase.update({
      where: { razorpayOrderId: orderId },
      data: {
        status: "COMPLETED",
      },
    });

    return NextResponse.json({ message: "Claim completed and PCC minted", txHash });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
