import { Router } from 'express';
import express from 'express';
import { createOrder, handleWebhook, verifyPayment, getUserPurchases, getPccConfig } from '../controllers/razorpay.controller';

const router = Router();

// Create order needs JSON body parsing
router.post('/create-order', express.json(), createOrder);

// Verify payment for frontend synchronous completion
router.post('/verify', express.json(), verifyPayment);

// Get user purchases
router.get('/purchases', express.json(), getUserPurchases);

// Frontend token config (authoritative contract used for minting)
router.get('/pcc-config', express.json(), getPccConfig);

// Webhook strictly requires raw body parsing to correctly compute the HMAC SHA256 verification hash
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

export default router;
