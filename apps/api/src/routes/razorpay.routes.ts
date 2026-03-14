import { Router } from 'express';
import express from 'express';
import { createOrder, handleWebhook, verifyPayment } from '../controllers/razorpay.controller';

const router = Router();

// Create order needs JSON body parsing
router.post('/create-order', express.json(), createOrder);

// Verify payment for frontend synchronous completion
router.post('/verify', express.json(), verifyPayment);

router.post('/after-payment', express.json(), (req, res) => { 
  console.log("tuja api");
  res.json({ message: "Success logged" });
});

// Webhook strictly requires raw body parsing to correctly compute the HMAC SHA256 verification hash
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

export default router;
