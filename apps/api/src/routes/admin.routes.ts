import express from 'express';
import { Router } from 'express';
import {
  getAdminAgreementById,
  banOrUnbanUser,
  deleteUserByAdmin,
  getAdminAgreements,
  getAdminAnalytics,
  getAdminPurchaseById,
  getAdminPurchases,
  getAdminTicketById,
  getAdminTickets,
  getAdminUserById,
  getAdminUsers,
  releaseAdminTicketFunds,
  updateAdminTicket,
} from '../controllers/admin.controller';

const router = Router();

router.get('/analytics', getAdminAnalytics);
router.get('/users', getAdminUsers);
router.get('/users/:userId', getAdminUserById);
router.patch('/users/:userId/ban', banOrUnbanUser);
router.delete('/users/:userId', deleteUserByAdmin);
router.get('/agreements', getAdminAgreements);
router.get('/agreements/:agreementId', getAdminAgreementById);
router.get('/tickets', getAdminTickets);
router.get('/tickets/:ticketId', getAdminTicketById);
router.patch('/tickets/:ticketId', updateAdminTicket);
router.post('/tickets/:ticketId/release-funds', express.json(), releaseAdminTicketFunds);
router.get('/purchases', getAdminPurchases);
router.get('/purchases/:purchaseId', getAdminPurchaseById);

export default router;
