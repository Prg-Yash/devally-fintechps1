import { Request, Response } from 'express';
import prisma from '../config/prisma';

const ALLOWED_TICKET_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'REJECTED'];
const ALLOWED_TICKET_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type TicketSeverity = (typeof ALLOWED_TICKET_SEVERITIES)[number];

export const createTicket = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      reason,
      severity,
      evidenceUrl,
      agreementId,
      raisedById,
      againstUserEmail,
    } = req.body;

    if (!title || !description || !reason || !raisedById || !againstUserEmail) {
      return res.status(400).json({
        error: 'title, description, reason, raisedById, and againstUserEmail are required',
      });
    }

    const normalizedSeverity: TicketSeverity = ALLOWED_TICKET_SEVERITIES.includes(
      String(severity).toUpperCase() as TicketSeverity
    )
      ? (String(severity).toUpperCase() as TicketSeverity)
      : 'LOW';

    const normalizedEmail = String(againstUserEmail).trim().toLowerCase();

    const againstUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, name: true, email: true },
    });

    if (!againstUser) {
      return res.status(404).json({ error: `User not found with email: ${normalizedEmail}` });
    }

    if (againstUser.id === raisedById) {
      return res.status(400).json({ error: 'You cannot raise a ticket against yourself' });
    }

    if (agreementId) {
      const agreement = await prisma.agreement.findUnique({
        where: { id: agreementId },
        select: { id: true, creatorId: true, receiverId: true },
      });

      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      const participants = [agreement.creatorId, agreement.receiverId];
      if (!participants.includes(raisedById) || !participants.includes(againstUser.id)) {
        return res.status(403).json({
          error: 'For an agreement-linked ticket, both users must be part of that agreement',
        });
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        reason: String(reason).trim().toUpperCase(),
        severity: normalizedSeverity,
        evidenceUrl: evidenceUrl ? String(evidenceUrl).trim() : null,
        agreementId: agreementId || null,
        raisedById,
        againstUserId: againstUser.id,
      },
      select: {
        id: true, title: true, description: true, reason: true,
        status: true, severity: true, evidenceUrl: true,
        createdAt: true, updatedAt: true,
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
    });

    return res.status(201).json({ message: 'Ticket raised successfully', ticket });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getRaisedTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const tickets = await prisma.ticket.findMany({
      where: { raisedById: userId },
      select: {
        id: true, title: true, description: true, reason: true,
        status: true, severity: true, evidenceUrl: true,
        createdAt: true, updatedAt: true,
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ message: 'Raised tickets fetched successfully', count: tickets.length, tickets });
  } catch (error: any) {
    console.error('Error fetching raised tickets:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getReceivedTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const tickets = await prisma.ticket.findMany({
      where: { againstUserId: userId },
      select: {
        id: true, title: true, description: true, reason: true,
        status: true, severity: true, evidenceUrl: true,
        createdAt: true, updatedAt: true,
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ message: 'Received tickets fetched successfully', count: tickets.length, tickets });
  } catch (error: any) {
    console.error('Error fetching received tickets:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getTicketById = async (req: Request, res: Response) => {
  try {
    const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId;
    const userId = req.query.userId as string;

    if (!ticketId || !userId) {
      return res.status(400).json({ error: 'ticketId path param and userId query parameter are required' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true, title: true, description: true, reason: true,
        status: true, severity: true, evidenceUrl: true,
        createdAt: true, updatedAt: true, raisedById: true, againstUserId: true,
        raisedBy: { select: { id: true, name: true, email: true } },
        againstUser: { select: { id: true, name: true, email: true } },
        agreement: { select: { id: true, title: true, status: true } },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.raisedById !== userId && ticket.againstUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view this ticket' });
    }

    return res.json({ message: 'Ticket fetched successfully', ticket });
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    return res.status(403).json({
      error: 'Ticket status cannot be changed by users. Only support/admin can update status.',
    });
  } catch (error: any) {
    console.error('Error updating ticket status:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
