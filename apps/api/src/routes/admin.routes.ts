import { Router } from 'express';
import {
  getAdminAgreementById,
  banOrUnbanUser,
  deleteUserByAdmin,
  getAdminAgreements,
  getAdminAnalytics,
  getAdminPurchases,
  getAdminTicketById,
  getAdminTickets,
  getAdminUserById,
  getAdminUsers,
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
router.get('/purchases', getAdminPurchases);

export default router;
