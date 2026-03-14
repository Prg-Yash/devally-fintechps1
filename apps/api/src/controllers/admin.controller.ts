import { Request, Response } from 'express';
import prisma from '../config/prisma';

const DEFAULT_LIMIT = 100;

const getLimit = (value: unknown) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, 500);
};

export const getAdminAnalytics = async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalAgreements,
      totalTickets,
      totalPurchases,
      agreementsByStatus,
      ticketsByStatus,
      purchasesByStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.agreement.count(),
      prisma.ticket.count(),
      prisma.purchase.count(),
      prisma.agreement.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.purchase.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    return res.json({
      totals: {
        users: totalUsers,
        agreements: totalAgreements,
        tickets: totalTickets,
        purchases: totalPurchases,
      },
      agreementsByStatus: agreementsByStatus.map((item) => ({ status: item.status, count: item._count._all })),
      ticketsByStatus: ticketsByStatus.map((item) => ({ status: item.status, count: item._count._all })),
      purchasesByStatus: purchasesByStatus.map((item) => ({ status: item.status, count: item._count._all })),
    });
  } catch (error: any) {
    console.error('Error fetching admin analytics:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getAdminUsers = async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req.query.limit);

    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            purchases: true,
            createdAgreements: true,
            receivedAgreements: true,
            raisedTickets: true,
            ticketsAgainstMe: true,
          },
        },
      },
    });

    return res.json({ count: users.length, users });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getAdminAgreements = async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req.query.limit);

    const agreements = await prisma.agreement.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: { select: { id: true, title: true, status: true, amount: true } },
        _count: { select: { tickets: true } },
      },
    });

    return res.json({ count: agreements.length, agreements });
  } catch (error: any) {
    console.error('Error fetching admin agreements:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getAdminTickets = async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req.query.limit);

    const tickets = await prisma.ticket.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
    });

    return res.json({ count: tickets.length, tickets });
  } catch (error: any) {
    console.error('Error fetching admin tickets:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getAdminPurchases = async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req.query.limit);

    const purchases = await prisma.purchase.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return res.json({ count: purchases.length, purchases });
  } catch (error: any) {
    console.error('Error fetching admin purchases:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
