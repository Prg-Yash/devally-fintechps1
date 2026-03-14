import { Router } from 'express';
import express from 'express';
import {
  createAgreement,
  getIncomingAgreements,
  getOutgoingAgreements,
  getAgreementById,
  updateAgreementStatus,
  getAgreementByProjectId,
} from '../controllers/agreement.controller';

const router = Router();

// Create a new agreement
router.post('/', express.json(), createAgreement);

// Search agreement by project ID
router.get('/search', getAgreementByProjectId);

// Get incoming agreements (where user is receiver)
router.get('/incoming', getIncomingAgreements);

// Get outgoing agreements (where user is creator)
router.get('/outgoing', getOutgoingAgreements);

// Get a specific agreement by ID
router.get('/:agreementId', getAgreementById);

// Update agreement status
router.put('/:agreementId/status', express.json(), updateAgreementStatus);

export default router;
