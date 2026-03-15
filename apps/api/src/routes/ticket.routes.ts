import { Router } from 'express';
import express from 'express';
import {
  createTicket,
  createTicketByEmail,
  getRaisedTickets,
  getReceivedTickets,
  getTicketById,
  updateTicketStatus,
} from '../controllers/ticket.controller';

const router = Router();

router.post('/', express.json(), createTicket);
router.post('/by-email', express.json(), createTicketByEmail);
router.get('/raised', getRaisedTickets);
router.get('/received', getReceivedTickets);
router.get('/:ticketId', getTicketById);
router.put('/:ticketId/status', express.json(), updateTicketStatus);

export default router;
