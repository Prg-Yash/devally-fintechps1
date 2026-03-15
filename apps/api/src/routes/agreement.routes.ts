import { Router } from 'express';
import express from 'express';
import {
  createDraftAgreement,
  updateDraftAgreement,
  requestAgreementChanges,
  approveAgreementForFunding,
  markAgreementFunded,
  setAgreementFundingError,
  markMilestonePaid,
  createAgreement,
  getIncomingAgreements,
  getOutgoingAgreements,
  getAgreementById,
  updateAgreementStatus,
  getAgreementByProjectId,
  linkAgreementToOnchainProject,
} from '../controllers/agreement.controller';

const router = Router();

// Draft workflow routes
router.post('/drafts', express.json(), createDraftAgreement);
router.put('/:agreementId/draft', express.json(), updateDraftAgreement);
router.put('/:agreementId/request-changes', express.json(), requestAgreementChanges);
router.put('/:agreementId/approve', express.json(), approveAgreementForFunding);
router.put('/:agreementId/publish', express.json(), markAgreementFunded);
router.put('/:agreementId/funding-error', express.json(), setAgreementFundingError);
router.put('/:agreementId/milestones/:milestoneId/paid', express.json(), markMilestonePaid);

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

// Manually link legacy off-chain agreement to on-chain project
router.put('/:agreementId/link-onchain', express.json(), linkAgreementToOnchainProject);

export default router;
