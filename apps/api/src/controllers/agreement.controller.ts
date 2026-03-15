import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { notifyUser } from '../config/notification-service';

type AgreementInclude = {
  creator: { select: { id: true; name: true; email: true; phoneNumber: true } };
  receiver: { select: { id: true; name: true; email: true; phoneNumber: true } };
  milestones: true;
  changeRequests: {
    include: {
      requestedBy: { select: { id: true; name: true; email: true } };
    };
    orderBy: { createdAt: 'desc' };
  };
};

const agreementInclude: AgreementInclude = {
  creator: { select: { id: true, name: true, email: true, phoneNumber: true } },
  receiver: { select: { id: true, name: true, email: true, phoneNumber: true } },
  milestones: true,
  changeRequests: {
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
};

const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();

export const createDraftAgreement = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      amount,
      currency,
      receiverEmail,
      creatorId,
      dueDate,
      milestones,
    } = req.body;

    if (!creatorId) {
      return res.status(400).json({ error: 'creatorId is required' });
    }

    if (!receiverEmail) {
      return res.status(400).json({ error: 'receiverEmail is required' });
    }

    const normalizedEmail = normalizeEmail(receiverEmail);
    const receiver = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true, name: true },
    });

    if (!receiver) {
      return res.status(404).json({
        error: 'User not found, please enter a valid email address',
        email: normalizedEmail,
      });
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, name: true, email: true },
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator user not found' });
    }

    const draft = await prisma.agreement.create({
      data: {
        title: title || 'Untitled Agreement',
        description,
        amount: Number(amount) || 0,
        currency: currency || 'PUSD',
        status: 'DRAFT',
        dueDate: dueDate ? new Date(dueDate) : null,
        creatorId,
        receiverId: receiver.id,
        milestones: {
          create: (milestones || []).map((milestone: any, index: number) => ({
            title: milestone.title,
            description: milestone.description,
            amount: Number(milestone.amount) || 0,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            order: Number.isFinite(milestone.order) ? Number(milestone.order) : index,
            status: milestone.status || 'PENDING',
          })),
        },
      },
      include: agreementInclude,
    });

    await notifyUser({
      userId: draft.receiverId,
      title: 'New agreement draft received',
      message: `You received draft "${draft.title}" from ${creator.email}.`,
      type: 'AGREEMENT',
      entityType: 'agreement',
      entityId: draft.id,
      emailSubject: 'Devally: New draft agreement pending your review',
    });

    return res.status(201).json({
      message: 'Draft agreement created successfully',
      agreement: draft,
    });
  } catch (error: any) {
    console.error('Error creating draft agreement:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const updateDraftAgreement = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { creatorId, title, description, amount, currency, dueDate, milestones } = req.body;

    if (!agreementId || !creatorId) {
      return res.status(400).json({ error: 'agreementId and creatorId are required' });
    }

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.creatorId !== creatorId) {
      return res.status(403).json({ error: 'Only the creator can edit draft terms' });
    }

    if (!['DRAFT', 'NEGOTIATING', 'READY_TO_FUND'].includes(agreement.status)) {
      return res.status(409).json({ error: `Cannot edit agreement in ${agreement.status} state` });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        title: title || agreement.title,
        description,
        amount: Number(amount) || 0,
        currency: currency || agreement.currency,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'DRAFT',
        fundingError: null,
        milestones: {
          deleteMany: {},
          create: (milestones || []).map((milestone: any, index: number) => ({
            title: milestone.title,
            description: milestone.description,
            amount: Number(milestone.amount) || 0,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            order: Number.isFinite(milestone.order) ? Number(milestone.order) : index,
            status: milestone.status || 'PENDING',
          })),
        },
      },
      include: agreementInclude,
    });

    await notifyUser({
      userId: updated.receiverId,
      title: 'Updated agreement received',
      message: `Client updated "${updated.title}" and sent it for your review.`,
      type: 'AGREEMENT',
      entityType: 'agreement',
      entityId: updated.id,
      emailSubject: 'Devally: Updated agreement waiting for your approval',
    });

    return res.json({
      message: 'Draft updated and resubmitted to freelancer',
      agreement: updated,
    });
  } catch (error: any) {
    console.error('Error updating draft agreement:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const resendAgreementForReview = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { creatorId } = req.body;

    if (!agreementId || !creatorId) {
      return res.status(400).json({ error: 'agreementId and creatorId are required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: agreementInclude,
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.creatorId !== creatorId) {
      return res.status(403).json({ error: 'Only the creator can resend agreement for review' });
    }

    if (!['DRAFT', 'NEGOTIATING'].includes(agreement.status)) {
      return res.status(409).json({ error: `Cannot resend agreement in ${agreement.status} state` });
    }

    await notifyUser({
      userId: agreement.receiverId,
      title: 'Agreement ready for your acceptance',
      message: `Client requested your acceptance for "${agreement.title}".`,
      type: 'AGREEMENT',
      entityType: 'agreement',
      entityId: agreement.id,
      emailSubject: 'Devally: Please review and accept agreement',
    });

    return res.json({
      message: 'Agreement resent to freelancer for acceptance',
      agreement,
    });
  } catch (error: any) {
    console.error('Error resending agreement for review:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const requestAgreementChanges = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { receiverId, note } = req.body;

    if (!agreementId || !receiverId || !note) {
      return res.status(400).json({ error: 'agreementId, receiverId and note are required' });
    }

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.receiverId !== receiverId) {
      return res.status(403).json({ error: 'Only the assigned freelancer can request changes' });
    }

    if (!['DRAFT', 'NEGOTIATING'].includes(agreement.status)) {
      return res.status(409).json({ error: `Cannot request changes in ${agreement.status} state` });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        status: 'NEGOTIATING',
        changeRequests: {
          create: {
            note: String(note),
            requestedById: receiverId,
          },
        },
      },
      include: agreementInclude,
    });

    return res.json({
      message: 'Change request logged successfully',
      agreement: updated,
    });
  } catch (error: any) {
    console.error('Error requesting agreement changes:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const approveAgreementForFunding = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { receiverId, receiverAddress } = req.body;

    if (!agreementId || !receiverId || !receiverAddress) {
      return res.status(400).json({ error: 'agreementId, receiverId and receiverAddress are required' });
    }

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.receiverId !== receiverId) {
      return res.status(403).json({ error: 'Only the assigned freelancer can approve this agreement' });
    }

    if (!['DRAFT', 'NEGOTIATING', 'READY_TO_FUND'].includes(agreement.status)) {
      return res.status(409).json({ error: `Cannot approve agreement in ${agreement.status} state` });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        receiverAddress,
        status: 'READY_TO_FUND',
        fundingError: null,
      },
      include: agreementInclude,
    });

    return res.json({
      message: 'Agreement approved and ready to fund',
      agreement: updated,
    });
  } catch (error: any) {
    console.error('Error approving agreement for funding:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const markAgreementFunded = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { creatorId, projectId, transactionHash, receiverAddress, clientRefId } = req.body;

    if (!agreementId || !creatorId) {
      return res.status(400).json({ error: 'agreementId and creatorId are required' });
    }

    if (projectId === undefined || projectId === null || Number.isNaN(Number(projectId))) {
      return res.status(400).json({ error: 'Valid projectId is required' });
    }

    if (!transactionHash) {
      return res.status(400).json({ error: 'transactionHash is required' });
    }

    const numericProjectId = Number(projectId);
    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.creatorId !== creatorId) {
      return res.status(403).json({ error: 'Only the client can mark agreement as funded' });
    }

    const conflict = await prisma.agreement.findUnique({ where: { projectId: numericProjectId } });
    if (conflict && conflict.id !== agreementId) {
      return res.status(409).json({
        error: 'projectId is already linked to another agreement',
        conflictAgreementId: conflict.id,
      });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        projectId: numericProjectId,
        transactionHash: String(transactionHash),
        receiverAddress: receiverAddress || agreement.receiverAddress,
        clientRefId: clientRefId ? String(clientRefId) : agreement.clientRefId,
        status: 'ACTIVE',
        fundingError: null,
      },
      include: agreementInclude,
    });

    return res.json({
      message: 'Agreement linked to on-chain project and activated',
      agreement: updated,
    });
  } catch (error: any) {
    console.error('Error linking agreement funding:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const setAgreementFundingError = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { creatorId, errorMessage } = req.body;

    if (!agreementId || !creatorId) {
      return res.status(400).json({ error: 'agreementId and creatorId are required' });
    }

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.creatorId !== creatorId) {
      return res.status(403).json({ error: 'Only the client can set funding error for this agreement' });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        status: 'READY_TO_FUND',
        fundingError: String(errorMessage || 'Funding transaction failed'),
      },
      include: agreementInclude,
    });

    return res.json({
      message: 'Funding error captured; agreement remains READY_TO_FUND',
      agreement: updated,
    });
  } catch (error: any) {
    console.error('Error setting agreement funding error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const markMilestonePaid = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const milestoneId = Array.isArray(req.params.milestoneId) ? req.params.milestoneId[0] : req.params.milestoneId;
    const { payoutTxHash } = req.body;

    if (!agreementId || !milestoneId) {
      return res.status(400).json({ error: 'agreementId and milestoneId are required' });
    }

    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.agreementId !== agreementId) {
      return res.status(404).json({ error: 'Milestone not found for this agreement' });
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        payoutTxHash: payoutTxHash ? String(payoutTxHash) : null,
      },
    });

    return res.json({
      message: 'Milestone marked as paid',
      milestone: updatedMilestone,
    });
  } catch (error: any) {
    console.error('Error marking milestone paid:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const createAgreement = async (req: Request, res: Response) => {
  // Legacy route compatibility: all creates are draft-first and off-chain.
  return createDraftAgreement(req, res);
};

export const getIncomingAgreements = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const agreements = await prisma.agreement.findMany({
      where: { receiverId: userId },
      include: agreementInclude,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      message: 'Incoming agreements fetched successfully',
      count: agreements.length,
      agreements,
    });
  } catch (error: any) {
    console.error('Error fetching incoming agreements:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
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
      include: agreementInclude,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      message: 'Outgoing agreements fetched successfully',
      count: agreements.length,
      agreements,
    });
  } catch (error: any) {
    console.error('Error fetching outgoing agreements:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const getAgreementById = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;

    if (!agreementId) {
      return res.status(400).json({ error: 'agreementId is required' });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: agreementInclude,
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    return res.json({
      message: 'Agreement fetched successfully',
      agreement,
    });
  } catch (error: any) {
    console.error('Error fetching agreement:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const updateAgreementStatus = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { status, userId } = req.body;

    if (!agreementId || !status || !userId) {
      return res.status(400).json({ error: 'agreementId, userId and status are required' });
    }

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.creatorId !== userId && agreement.receiverId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this agreement' });
    }

    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: { status },
      include: agreementInclude,
    });

    const otherPartyId = agreement.creatorId === userId ? agreement.receiverId : agreement.creatorId;
    await notifyUser({
      userId: otherPartyId,
      title: 'Agreement status updated',
      message: `Agreement "${updatedAgreement.title}" is now ${updatedAgreement.status}.`,
      type: 'AGREEMENT',
      entityType: 'agreement',
      entityId: updatedAgreement.id,
      emailSubject: 'Devally: Agreement status changed',
    });

    return res.json({
      message: 'Agreement status updated successfully',
      agreement: updatedAgreement,
    });
  } catch (error: any) {
    console.error('Error updating agreement:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
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
      include: agreementInclude,
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found for this project ID' });
    }

    return res.json({
      message: 'Agreement fetched successfully',
      agreement,
    });
  } catch (error: any) {
    console.error('Error searching agreement:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const linkAgreementToOnchainProject = async (req: Request, res: Response) => {
  try {
    const agreementId = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;
    const { projectId, transactionHash, receiverAddress } = req.body;

    if (!agreementId) {
      return res.status(400).json({ error: 'agreementId is required' });
    }

    if (projectId === undefined || projectId === null || Number.isNaN(Number(projectId))) {
      return res.status(400).json({ error: 'Valid projectId is required' });
    }

    const numericProjectId = Number(projectId);

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    const conflict = await prisma.agreement.findUnique({ where: { projectId: numericProjectId } });
    if (conflict && conflict.id !== agreementId) {
      return res.status(409).json({
        error: 'projectId is already linked to another agreement',
        conflictAgreementId: conflict.id,
      });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        projectId: numericProjectId,
        transactionHash: transactionHash || agreement.transactionHash,
        receiverAddress: receiverAddress || agreement.receiverAddress,
        status: 'ACTIVE',
        fundingError: null,
      },
      include: agreementInclude,
    });

    return res.json({
      message: 'Agreement linked to on-chain project successfully',
      agreement: updated,
    });
  } catch (error: any) {
    console.error('Error linking agreement to on-chain project:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
