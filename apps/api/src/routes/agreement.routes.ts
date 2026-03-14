import { Router } from 'express';
import express from 'express';
import {
  createAgreement,
  getIncomingAgreements,
  getOutgoingAgreements,
  getAgreementById,
  updateAgreementStatus,
} from '../controllers/agreement.controller';

const router = Router();

// Create a new agreement
router.post('/', express.json(), createAgreement);

// Get incoming agreements (where user is receiver)
router.get('/incoming', express.json(), getIncomingAgreements);

// Get outgoing agreements (where user is creator)
router.get('/outgoing', express.json(), getOutgoingAgreements);

// Get a specific agreement by ID
router.get('/:agreementId', express.json(), getAgreementById);

// Update agreement status
router.put('/:agreementId/status', express.json(), updateAgreementStatus);

export default router;
