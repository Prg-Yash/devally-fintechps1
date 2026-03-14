import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import {
  getPccContractAddress,
  INR_TO_PCC_RATE,
  isPccDistributorConfigured,
  mintPccToWallet,
} from "@/lib/pcc-distributor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeySecret) {
      return NextResponse.json(
        { message: "RAZORPAY_KEY_SECRET is missing in apps/web/.env" },
        { status: 500 },
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, walletAddress } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ message: "walletAddress is required" }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ message: "Invalid walletAddress format" }, { status: 400 });
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return NextResponse.json({ message: "Invalid signature sent" }, { status: 400 });
    }

    const existingPurchase = await prisma.purchase.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!existingPurchase) {
      return NextResponse.json({ message: "Purchase not found for this order id" }, { status: 404 });
    }

    if (existingPurchase.status === "COMPLETED") {
      return NextResponse.json({ message: "Payment already completed" });
    }

    const pccAmount = existingPurchase.amount * INR_TO_PCC_RATE;

    await prisma.purchase.update({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        status: "PAYMENT_VERIFIED",
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    if (isPccDistributorConfigured()) {
      const txHash = await mintPccToWallet(walletAddress as `0x${string}`, pccAmount);

      await prisma.purchase.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: "COMPLETED",
        },
      });

      return NextResponse.json({
        message: "Payment verified and PCC minted successfully",
        orderId: razorpay_order_id,
        canClaim: false,
        txHash,
        contractAddress: getPccContractAddress() ?? null,
      });
    }

    return NextResponse.json({
      message: "Payment verified successfully",
      orderId: razorpay_order_id,
      canClaim: true,
      contractAddress: getPccContractAddress() ?? null,
      warning:
        "Auto mint not configured on server. Set PCC_DISTRIBUTOR_PRIVATE_KEY and SEPOLIA_RPC_URL to mint immediately after payment.",
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
