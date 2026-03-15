import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const INR_TO_PCC_RATE = Number(process.env.INR_TO_PCC_RATE ?? process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1");

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const enriched = purchases.map((purchase) => ({
      ...purchase,
      pccAmount: purchase.amount * INR_TO_PCC_RATE,
      conversionRate: INR_TO_PCC_RATE,
      conversionType: "INR_TO_PCC",
    }));

    return NextResponse.json({ purchases: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
