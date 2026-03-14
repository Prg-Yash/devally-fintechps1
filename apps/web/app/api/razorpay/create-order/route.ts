import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const INR_TO_PCC_RATE = Number(process.env.INR_TO_PCC_RATE ?? process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1");

export async function POST(req: NextRequest) {
  try {
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        {
          error:
            "Razorpay is not configured. Set RAZORPAY_KEY_ID (or NEXT_PUBLIC_RAZORPAY_KEY_ID) and RAZORPAY_KEY_SECRET in apps/web/.env.",
        },
        { status: 500 },
      );
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const { amount, userId, walletAddress } = await req.json();

    if (!amount || !userId || !walletAddress) {
      return NextResponse.json({ error: "amount, userId, and walletAddress are required" }, { status: 400 });
    }

    if (Number(amount) <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
    }

    const pccAmount = Number(amount) * INR_TO_PCC_RATE;

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        walletAddress,
        conversionType: "INR_TO_PCC",
        pccAmount: pccAmount.toFixed(2),
      },
    });

    await prisma.purchase.create({
      data: {
        userId,
        amount: Number(amount),
        razorpayOrderId: order.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      pccAmount,
      conversionRate: INR_TO_PCC_RATE,
      keyId: razorpayKeyId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
