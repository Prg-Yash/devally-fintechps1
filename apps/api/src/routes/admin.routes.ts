import { Router } from 'express';
import {
  getAdminAgreements,
  getAdminAnalytics,
  getAdminPurchases,
  getAdminTickets,
  getAdminUsers,
} from '../controllers/admin.controller';

const router = Router();

router.get('/analytics', getAdminAnalytics);
router.get('/users', getAdminUsers);
router.get('/agreements', getAdminAgreements);
router.get('/tickets', getAdminTickets);
router.get('/purchases', getAdminPurchases);

export default router;
