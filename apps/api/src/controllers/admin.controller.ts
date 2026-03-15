import { Request, Response } from 'express';
import { TicketSeverity } from '@prisma/client';
import prisma from '../config/prisma';
import { notifyUser } from '../config/notification-service';

const DEFAULT_LIMIT = 100;
const ALLOWED_TICKET_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'REJECTED'] as const;
const ALLOWED_TICKET_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

type AdminTicketStatus = (typeof ALLOWED_TICKET_STATUSES)[number];
type AdminTicketSeverity = (typeof ALLOWED_TICKET_SEVERITIES)[number];

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
        isBanned: true,
        bannedAt: true,
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

export const getAdminUserById = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
          },
        },
        accounts: {
          select: {
            id: true,
            providerId: true,
            createdAt: true,
          },
        },
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            amount: true,
            status: true,
            razorpayOrderId: true,
            createdAt: true,
          },
        },
        createdAgreements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
        receivedAgreements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
        raisedTickets: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        },
        ticketsAgainstMe: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        },
        passkeys: {
          select: {
            id: true,
            name: true,
            deviceType: true,
            createdAt: true,
          },
        },
        twofactors: {
          select: {
            id: true,
            secret: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            accounts: true,
            purchases: true,
            createdAgreements: true,
            receivedAgreements: true,
            raisedTickets: true,
            ticketsAgainstMe: true,
            passkeys: true,
            twofactors: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error: any) {
    console.error('Error fetching admin user details:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const banOrUnbanUser = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const isBanned = req.body?.isBanned;
    const durationHours = req.body?.duration; // Optional duration in hours

    if (!userId || typeof isBanned !== 'boolean') {
      return res.status(400).json({ error: 'userId and boolean isBanned are required' });
    }

    let banExpiresAt: Date | null = null;
    if (isBanned && durationHours && typeof durationHours === 'number' && durationHours > 0) {
      banExpiresAt = new Date();
      banExpiresAt.setHours(banExpiresAt.getHours() + durationHours);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned,
        bannedAt: isBanned ? new Date() : null,
        banExpiresAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isBanned: true,
        bannedAt: true,
        banExpiresAt: true,
      },
    });

    return res.json({
      message: isBanned 
        ? `User banned successfully${durationHours ? ` for ${durationHours}h` : ' permanently'}` 
        : 'User unbanned successfully',
      user,
    });
  } catch (error: any) {
    console.error('Error banning/unbanning user:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const deleteUserByAdmin = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id: userId } });

    return res.json({
      message: 'User deleted successfully',
      deletedUser: existing,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
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

export const getAdminAgreementById = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;

    if (!agreementId) {
      return res.status(400).json({ error: 'agreementId is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            amount: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            createdAt: true,
          },
        },
      },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    return res.json({ agreement });
  } catch (error: any) {
    console.error('Error fetching admin agreement details:', error);
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

export const getAdminTicketById = async (req: Request, res: Response) => {
  try {
    const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId;

    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    return res.json({ ticket });
  } catch (error: any) {
    console.error('Error fetching admin ticket details:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const updateAdminTicket = async (req: Request, res: Response) => {
  try {
    const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId;
    const rawStatus = req.body?.status;
    const rawSeverity = req.body?.severity;

    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    if (rawStatus == null && rawSeverity == null) {
      return res.status(400).json({ error: 'At least one of status or severity is required' });
    }

    let normalizedStatus: AdminTicketStatus | undefined;
    let normalizedSeverity: AdminTicketSeverity | undefined;

    if (rawStatus != null) {
      const candidate = String(rawStatus).toUpperCase() as AdminTicketStatus;
      if (!ALLOWED_TICKET_STATUSES.includes(candidate)) {
        return res.status(400).json({
          error: `Invalid status. Allowed values: ${ALLOWED_TICKET_STATUSES.join(', ')}`,
        });
      }
      normalizedStatus = candidate;
    }

    if (rawSeverity != null) {
      const candidate = String(rawSeverity).toUpperCase() as AdminTicketSeverity;
      if (!ALLOWED_TICKET_SEVERITIES.includes(candidate)) {
        return res.status(400).json({
          error: `Invalid severity. Allowed values: ${ALLOWED_TICKET_SEVERITIES.join(', ')}`,
        });
      }
      normalizedSeverity = candidate;
    }

    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, raisedById: true, againstUserId: true },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...(normalizedSeverity ? { severity: normalizedSeverity } : {}),
      },
      select: {
        id: true,
        title: true,
        reason: true,
        status: true,
        severity: true,
        evidenceUrl: true,
        createdAt: true,
        updatedAt: true,
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
    });

    const notifyTargets = Array.from(new Set([existingTicket.raisedById, existingTicket.againstUserId]));
    await Promise.all(
      notifyTargets.map((targetUserId) =>
        notifyUser({
          userId: targetUserId,
          title: 'Ticket updated by admin',
          message: `Ticket "${updatedTicket.title}" is now ${updatedTicket.status} with ${updatedTicket.severity} severity.`,
          type: 'TICKET',
          entityType: 'ticket',
          entityId: updatedTicket.id,
          emailSubject: 'Devally: Ticket update from admin',
        })
      )
    );

    return res.json({
      message: 'Ticket updated successfully',
      ticket: updatedTicket,
    });
  } catch (error: any) {
    console.error('Error updating admin ticket:', error);
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

export const getAdminPurchaseById = async (req: Request, res: Response) => {
  try {
    const purchaseId = Array.isArray(req.params.purchaseId) ? req.params.purchaseId[0] : req.params.purchaseId;

    if (!purchaseId) {
      return res.status(400).json({ error: 'purchaseId is required' });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    return res.json({ purchase });
  } catch (error: any) {
    console.error('Error fetching admin purchase details:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
