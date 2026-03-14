import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getPccContractAddress } from "@/lib/pcc-distributor";

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

    const body = await req.json();
    const razorpay_order_id = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const razorpay_payment_id = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const razorpay_signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";
    const walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress : "";

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" },
        { status: 400 },
      );
    }

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

    const existingPurchase = await prisma.purchase.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!existingPurchase) {
      return NextResponse.json({ message: "Purchase not found for this order id" }, { status: 404 });
    }

    if (existingPurchase.status === "COMPLETED") {
      return NextResponse.json({ message: "Payment already completed" });
    }

    await prisma.purchase.updateMany({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        status: "PAYMENT_VERIFIED",
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    return NextResponse.json({
      message: "Payment verified successfully",
      orderId: razorpay_order_id,
      canClaim: true,
      contractAddress: getPccContractAddress() ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
