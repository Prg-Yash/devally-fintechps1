import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const createAgreement = async (req: Request, res: Response) => {
  try {
    const { title, description, amount, currency, receiverEmail, milestones } = req.body;
    const creatorId = (req as any).userId;

    // Validate required fields
    if (!title || !amount || !receiverEmail || !creatorId) {
      return res.status(400).json({
        error: 'title, amount, receiverEmail, and userId (from auth) are required',
      });
    }

    // Find the receiver by email
    const receiver = await prisma.user.findUnique({
      where: { email: receiverEmail },
    });

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver user not found with the provided email' });
    }

    // Prevent creating agreement with self
    if (creatorId === receiver.id) {
      return res.status(400).json({ error: 'Cannot create agreement with yourself' });
    }

    // Create agreement with milestones
    const agreement = await prisma.agreement.create({
      data: {
        title,
        description,
        amount,
        currency: currency || 'USDC',
        creatorId,
        receiverId: receiver.id,
        milestones: {
          create: milestones?.map((milestone: any) => ({
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
          })) || [],
        },
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: true,
      },
    });

    res.status(201).json({
      message: 'Agreement created successfully',
      agreement,
    });
  } catch (error: any) {
    console.error('Error creating agreement:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getIncomingAgreements = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required (from auth)' });
    }

    const agreements = await prisma.agreement.findMany({
      where: { receiverId: userId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      message: 'Incoming agreements fetched successfully',
      count: agreements.length,
      agreements,
    });
  } catch (error: any) {
    console.error('Error fetching incoming agreements:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getOutgoingAgreements = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required (from auth)' });
    }

    const agreements = await prisma.agreement.findMany({
      where: { creatorId: userId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      message: 'Outgoing agreements fetched successfully',
      count: agreements.length,
      agreements,
    });
  } catch (error: any) {
    console.error('Error fetching outgoing agreements:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getAgreementById = async (req: Request, res: Response) => {
  try {
    const { agreementId } = req.params;
    const userId = (req as any).userId;

    if (!agreementId) {
      return res.status(400).json({ error: 'agreementId is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: true,
      },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is either creator or receiver
    if (agreement.creatorId !== userId && agreement.receiverId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view this agreement' });
    }

    res.json({
      message: 'Agreement fetched successfully',
      agreement,
    });
  } catch (error: any) {
    console.error('Error fetching agreement:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const updateAgreementStatus = async (req: Request, res: Response) => {
  try {
    const { agreementId } = req.params;
    const { status } = req.body;
    const userId = (req as any).userId;

    if (!agreementId || !status) {
      return res.status(400).json({ error: 'agreementId and status are required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is creator or receiver
    if (agreement.creatorId !== userId && agreement.receiverId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this agreement' });
    }

    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: { status },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        milestones: true,
      },
    });

    res.json({
      message: 'Agreement status updated successfully',
      agreement: updatedAgreement,
    });
  } catch (error: any) {
    console.error('Error updating agreement:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
