import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const createAgreement = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      amount,
      currency,
      status,
      receiverEmail,
      creatorId,
      milestones,
      projectId,
      receiverAddress,
      transactionHash
    } = req.body;

    // Validate required fields
    if (!creatorId) {
      return res.status(400).json({
        error: 'Creator ID is required',
      });
    }

    // Validate receiver email exists
    if (!receiverEmail) {
      return res.status(400).json({
        error: 'Receiver email is required',
      });
    }

    // Normalize email: trim and convert to lowercase
    const normalizedEmail = receiverEmail.trim().toLowerCase();

    console.log(`Looking for user with email: "${normalizedEmail}" (original: "${receiverEmail}")`);

    // Find the receiver by email (case-insensitive)
    const receiver = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        }
      },
    });

    if (!receiver) {
      console.log(`User not found with email: ${normalizedEmail}`);
      // List all users for debugging
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
      });
      console.log('Available users:', allUsers);

      return res.status(404).json({
        error: `User not found with email: ${normalizedEmail}`,
        inputEmail: receiverEmail,
        normalizedEmail: normalizedEmail
      });
    }

    console.log(`Found user: ${receiver.id} with email: ${receiver.email}`);

    const normalizedProjectId = projectId !== undefined && projectId !== null
      ? Number(projectId)
      : null;

    let agreement;

    // Idempotent by projectId: update existing row if this on-chain project already exists.
    if (normalizedProjectId !== null && !Number.isNaN(normalizedProjectId)) {
      const existing = await prisma.agreement.findUnique({
        where: { projectId: normalizedProjectId },
      });

      if (existing) {
        agreement = await prisma.agreement.update({
          where: { id: existing.id },
          data: {
            title: title || existing.title || 'Untitled Agreement',
            description,
            amount: amount || 0,
            currency: currency || existing.currency || 'USDC',
            status: status || existing.status || 'PENDING',
            creatorId,
            receiverId: receiver.id,
            projectId: normalizedProjectId,
            receiverAddress: receiverAddress || req.body.freelancerAddress,
            transactionHash,
            milestones: {
              deleteMany: {},
              create: milestones?.map((milestone: any) => ({
                title: milestone.title,
                description: milestone.description,
                amount: milestone.amount,
                dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
              })) || [],
            },
          },
          include: {
            creator: { select: { name: true, email: true } },
            receiver: { select: { name: true, email: true } },
            milestones: true,
          },
        });
      }
    }

    if (!agreement) {
      agreement = await prisma.agreement.create({
        data: {
          title: title || 'Untitled Agreement',
          description,
          amount: amount || 0,
          currency: currency || 'USDC',
          status: status || 'PENDING',
          creatorId,
          receiverId: receiver.id,
          projectId: normalizedProjectId,
          receiverAddress: receiverAddress || req.body.freelancerAddress,
          transactionHash,
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
          creator: { select: { name: true, email: true } },
          receiver: { select: { name: true, email: true } },
          milestones: true,
        },
      });
    }

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
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const agreements = await prisma.agreement.findMany({
      where: { receiverId: userId },
      include: {
        creator: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } },
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
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const agreements = await prisma.agreement.findMany({
      where: { creatorId: userId },
      include: {
        creator: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } },
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
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const userId = (req as any).userId;

    if (!agreementId) {
      return res.status(400).json({ error: 'agreementId is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        creator: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } },
        milestones: true,
      },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
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
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
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
        creator: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } },
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
export const getAgreementByProjectId = async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { projectId: Number(projectId) },
      include: {
        creator: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } },
        milestones: true,
      },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found for this project ID' });
    }

    res.json({
      message: 'Agreement fetched successfully',
      agreement,
    });
  } catch (error: any) {
    console.error('Error searching agreement:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
