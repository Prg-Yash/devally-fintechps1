import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { orderId, userId } = await req.json();

    if (!orderId || !userId) {
      return NextResponse.json({ error: "orderId and userId are required" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findFirst({
      where: {
        razorpayOrderId: orderId,
        userId,
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.status !== "PENDING") {
      return NextResponse.json(
        { error: `Only PENDING orders can be cancelled. Current status: ${purchase.status}` },
        { status: 409 },
      );
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    let razorpayNoteUpdated = false;
    if (razorpayKeyId && razorpayKeySecret) {
      try {
        const razorpay = new Razorpay({
          key_id: razorpayKeyId,
          key_secret: razorpayKeySecret,
        });

        // Razorpay Orders API does not provide a hard cancel endpoint.
        // We tag the order notes for audit and treat it as cancelled in our system.
        await razorpay.orders.edit(orderId, {
          notes: {
            devally_status: "CANCELLED",
            cancelled_at: new Date().toISOString(),
          },
        });
        razorpayNoteUpdated = true;
      } catch {
        razorpayNoteUpdated = false;
      }
    }

    await prisma.purchase.update({
      where: { razorpayOrderId: orderId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({
      message: "Order cancelled successfully",
      razorpayNoteUpdated,
      note:
        "Razorpay Orders do not support hard cancellation; order is cancelled in system and tagged in Razorpay notes when credentials permit.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
