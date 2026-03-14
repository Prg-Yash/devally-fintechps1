import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type BanStatusRow = {
  isBanned: boolean | null;
  bannedAt: Date | null;
  banExpiresAt: Date | null;
};

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

    let isBanned = false;
    let bannedAt: Date | null = null;
    let banExpiresAt: Date | null = null;

    // Read ban fields via raw SQL so this route remains stable even when Prisma client/schema
    // generation is temporarily out of sync with recently added columns.
    try {
      const rows = await prisma.$queryRaw<BanStatusRow[]>`
        SELECT "isBanned", "bannedAt", "banExpiresAt"
        FROM "user"
        WHERE id = ${user.id}
        LIMIT 1
      `;

      const row = rows[0];
      if (row) {
        isBanned = Boolean(row.isBanned);
        bannedAt = row.bannedAt;
        banExpiresAt = row.banExpiresAt;
      }

      // Timed ban logic: automatically clear expired bans.
      if (isBanned && banExpiresAt && new Date() > banExpiresAt) {
        await prisma.$executeRaw`
          UPDATE "user"
          SET "isBanned" = false,
              "bannedAt" = NULL,
              "banExpiresAt" = NULL
          WHERE id = ${user.id}
        `;

        isBanned = false;
        bannedAt = null;
        banExpiresAt = null;
      }
    } catch {
      // Ban columns may not exist yet in DB. Treat as not banned instead of failing the route.
      isBanned = false;
      bannedAt = null;
      banExpiresAt = null;
    }

    return NextResponse.json({
      isAuthenticated: true,
      isBanned,
      bannedAt,
      banExpiresAt,
      message: isBanned
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
