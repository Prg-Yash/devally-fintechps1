import { Router } from 'express';
import express from 'express';
import {
  createTicket,
  getRaisedTickets,
  getReceivedTickets,
  getTicketById,
  updateTicketStatus,
} from '../controllers/ticket.controller';

const router = Router();

router.post('/', express.json(), createTicket);
router.get('/raised', getRaisedTickets);
router.get('/received', getReceivedTickets);
router.get('/:ticketId', getTicketById);
router.put('/:ticketId/status', express.json(), updateTicketStatus);

export default router;
