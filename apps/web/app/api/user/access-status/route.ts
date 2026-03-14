import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          isAuthenticated: false,
          isBanned: false,
          message: "Not authenticated",
        },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isBanned: true,
        bannedAt: true,
        banExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          isAuthenticated: false,
          isBanned: false,
          message: "User not found",
        },
        { status: 404 },
      );
    }

    // Timed Ban Logic
    if (user.isBanned && user.banExpiresAt && new Date() > user.banExpiresAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isBanned: false,
          banExpiresAt: null,
          bannedAt: null,
        },
      });
      user.isBanned = false;
    }

    return NextResponse.json({
      isAuthenticated: true,
      isBanned: user.isBanned,
      bannedAt: user.bannedAt,
      message: user.isBanned
        ? "Your account is banned. Please contact admin support."
        : "Account is active",
    });
  } catch (error) {
    console.error("Error checking access status:", error);
    return NextResponse.json(
      {
        isAuthenticated: false,
        isBanned: false,
        message: "Failed to check account status",
      },
      { status: 500 },
    );
  }
}
