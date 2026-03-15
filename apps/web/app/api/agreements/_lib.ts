import { randomUUID } from "crypto";

import prisma from "@/lib/prisma";

type AnyRecord = Record<string, any>;

type RouteErrorResponse = {
  status: number;
  body: {
    error: string;
    code?: string;
  };
};

const db = prisma as any;

const isSchemaDriftError = (error: any) => {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";
  const missingColumn = message.includes("does not exist") && message.includes("dueDate");
  return code === "P2022" || missingColumn;
};

export const mapAgreementRouteError = (
  error: any,
  fallbackMessage: string,
): RouteErrorResponse => {
  if (isSchemaDriftError(error)) {
    return {
      status: 503,
      body: {
        code: "DB_SCHEMA_OUTDATED",
        error:
          "Database schema is out of date. Run `npx prisma db push` in packages/db, then restart the web server.",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: error?.message || fallbackMessage,
    },
  };
};

const AGREEMENT_SELECT_PRIMARY = {
  id: true,
  title: true,
  description: true,
  amount: true,
  status: true,
  currency: true,
  dueDate: true,
  fundingError: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  receiverAddress: true,
  transactionHash: true,
  creatorId: true,
  receiverId: true,
};

const AGREEMENT_SELECT_FALLBACK = {
  id: true,
  title: true,
  amount: true,
  status: true,
  creatorId: true,
  receiverId: true,
};

const withAgreementSelectFallback = async (
  run: (select: Record<string, boolean>) => Promise<any>,
): Promise<any> => {
  try {
    return await run(AGREEMENT_SELECT_PRIMARY);
  } catch {
    return run(AGREEMENT_SELECT_FALLBACK);
  }
};

const toUserShape = (user: AnyRecord | null) => {
  if (!user) return null;

  return {
    id: String(user.id),
    name: String(user.name || user.email || "User"),
    email: String(user.email || ""),
    phoneNumber: user.phoneNumber || undefined,
    address: user.address || undefined,
  };
};

export const getUserById = async (userId: string) => {
  if (!userId) return null;

  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
};

export const getUserByEmail = async (email: string) => {
  if (!email) return null;

  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
};

export const getAgreementById = async (agreementId: string): Promise<AnyRecord | null> => {
  if (!agreementId) return null;

  return withAgreementSelectFallback((select) =>
    db.agreement.findUnique({
      where: { id: agreementId },
      select,
    }),
  );
};

export const getMilestonesByAgreementId = async (agreementId: string) => {
  try {
    return await db.milestone.findMany({
      where: { agreementId },
      orderBy: { order: "asc" },
    });
  } catch {
    return db.milestone.findMany({
      where: { agreementId },
      orderBy: { createdAt: "asc" },
    });
  }
};

export const getChangeRequestsByAgreementId = async (agreementId: string) => {
  if (!db.agreementChangeRequest?.findMany) {
    return [];
  }

  try {
    return await db.agreementChangeRequest.findMany({
      where: { agreementId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
};

export const shapeAgreement = async (agreementRow: AnyRecord) => {
  const agreementId = String(agreementRow.id);

  const [creator, receiver, milestones, changeRequestRows] = await Promise.all([
    agreementRow.creator ? Promise.resolve(agreementRow.creator) : getUserById(String(agreementRow.creatorId || "")),
    agreementRow.receiver ? Promise.resolve(agreementRow.receiver) : getUserById(String(agreementRow.receiverId || "")),
    getMilestonesByAgreementId(agreementId),
    getChangeRequestsByAgreementId(agreementId),
  ]);

  const requestedByIds = Array.from(
    new Set(
      changeRequestRows
        .map((row: AnyRecord) => row.requestedById)
        .filter((value: unknown) => typeof value === "string" && value.length > 0),
    ),
  ) as string[];

  const requestUsers = await Promise.all(requestedByIds.map((id) => getUserById(id)));
  const requestUserMap = new Map(requestUsers.filter(Boolean).map((user: AnyRecord) => [String(user.id), user]));

  return {
    id: agreementId,
    title: String(agreementRow.title || ""),
    description: agreementRow.description || "",
    amount: Number(agreementRow.amount || 0),
    currency: String(agreementRow.currency || "PUSD"),
    status: String(agreementRow.status || "DRAFT"),
    createdAt: agreementRow.createdAt || new Date().toISOString(),
    dueDate: agreementRow.dueDate || null,
    creatorId: agreementRow.creatorId || null,
    receiverId: agreementRow.receiverId || null,
    creator: toUserShape(creator),
    receiver: toUserShape(receiver),
    projectId: agreementRow.projectId ?? null,
    receiverAddress: agreementRow.receiverAddress ?? null,
    transactionHash: agreementRow.transactionHash ?? null,
    fundingError: agreementRow.fundingError ?? null,
    milestones: milestones.map((milestone: AnyRecord) => ({
      id: String(milestone.id),
      title: String(milestone.title || ""),
      description: milestone.description || "",
      amount: Number(milestone.amount || 0),
      status: String(milestone.status || "PENDING"),
      dueDate: milestone.dueDate || null,
      paidAt: milestone.paidAt || null,
      payoutTxHash: milestone.payoutTxHash || null,
    })),
    changeRequests: changeRequestRows.map((entry: AnyRecord) => ({
      id: String(entry.id),
      note: String(entry.note || ""),
      createdAt: entry.createdAt || new Date().toISOString(),
      requestedBy: entry.requestedById ? toUserShape(requestUserMap.get(String(entry.requestedById)) || null) : null,
    })),
  };
};

export const createDraftAgreement = async (input: {
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  creatorId: string;
  receiverId: string;
  receiverAddress?: string | null;
  milestones: Array<{
    title: string;
    description: string | null;
    amount: number;
    dueDate: string | null;
    order: number;
    status: string;
  }>;
}) => {
  const agreementId = randomUUID();

  await db.$transaction(async (tx: any) => {
    await tx.agreement.create({
      data: {
        id: agreementId,
        title: input.title,
        description: input.description,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        dueDate: new Date(input.dueDate),
        creatorId: input.creatorId,
        receiverId: input.receiverId,
        receiverAddress: input.receiverAddress ?? null,
      },
    });

    if (input.milestones.length) {
      if (tx.milestone.createMany) {
        await tx.milestone.createMany({
          data: input.milestones.map((milestone) => ({
            id: randomUUID(),
            agreementId,
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            order: milestone.order,
            status: milestone.status,
          })),
        });
      } else {
        for (const milestone of input.milestones) {
          await tx.milestone.create({
            data: {
              id: randomUUID(),
              agreementId,
              title: milestone.title,
              description: milestone.description,
              amount: milestone.amount,
              dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
              order: milestone.order,
              status: milestone.status,
            },
          });
        }
      }
    }
  });

  return agreementId;
};

export const updateAgreementColumns = async (
  agreementId: string,
  updates: Record<string, any>,
  allowedColumns: string[],
) => {
  const data: Record<string, any> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedColumns.includes(key)) continue;
    if (typeof value === "undefined") continue;
    data[key] = value;
  }

  if (!Object.keys(data).length) return;

  await db.agreement.update({
    where: { id: agreementId },
    data,
  });
};

export const createChangeRequest = async (input: {
  agreementId: string;
  requestedById: string;
  note: string;
}) => {
  if (!db.agreementChangeRequest?.create) {
    return null;
  }

  const created = await db.agreementChangeRequest.create({
    data: {
      id: randomUUID(),
      agreementId: input.agreementId,
      requestedById: input.requestedById,
      note: input.note,
    },
    select: { id: true },
  });

  return created.id;
};

export const listAgreementsByRole = async (input: {
  userId: string;
  role: "incoming" | "outgoing";
}): Promise<any[]> => {
  const where = input.role === "incoming" ? { receiverId: input.userId } : { creatorId: input.userId };

  let rows: any[] = [];

  try {
    rows = await withAgreementSelectFallback((select) =>
      db.agreement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select,
      }),
    );
  } catch {
    rows = await withAgreementSelectFallback((select) =>
      db.agreement.findMany({
        where,
        select,
      }),
    );
  }

  return Promise.all(rows.map((row: AnyRecord) => shapeAgreement(row)));
};

export const findAgreementByProjectId = async (projectId: number): Promise<AnyRecord | null> => {
  try {
    return await withAgreementSelectFallback((select) =>
      db.agreement.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select,
      }),
    );
  } catch {
    return withAgreementSelectFallback((select) =>
      db.agreement.findFirst({
        where: { projectId },
        select,
      }),
    );
  }
};
