import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    contractAddress: process.env.NEXT_PUBLIC_PCC_CONTRACT_ADDRESS ?? null,
    conversionRate: Number(process.env.INR_TO_PCC_RATE ?? process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1"),
  });
}
