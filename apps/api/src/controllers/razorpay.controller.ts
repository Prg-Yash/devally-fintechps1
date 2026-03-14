import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { razorpay } from '../config/razorpay';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { amount, userId } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({ error: 'amount and userId are required' });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert INR to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).json({ error: 'Failed to create Razorpay order' });
    }

    // Save pending transaction to Database
    await prisma.purchase.create({
      data: {
        userId,
        amount,
        razorpayOrderId: order.id,
        status: 'PENDING',
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET as string;

    if (!signature || !webhookSecret) {
      return res.status(400).send('Missing signature or webhook secret');
    }

    // Compute the expected signature using the EXACT RAW body string
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).send('Invalid webhook signature');
    }

    // Since we used express.raw() in the route, req.body is a Buffer
    const event = JSON.parse(req.body.toString());

    // We only care about successful payment captures
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;

      // Update Database
      await prisma.purchase.update({
        where: { razorpayOrderId: orderId },
        data: {
          status: 'SUCCESS',
          razorpayPaymentId: paymentId,
        },
      });

      console.log(`[Webhook] Purchase Success: Order ${orderId} by Payment ${paymentId}`);
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Webhook error');
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment is authentic, update the DB synchronously
      await prisma.purchase.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'SUCCESS',
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      console.log(`[Frontend Verification] Payment Done! Order: ${razorpay_order_id}`);
      return res.status(200).json({ message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ message: "Invalid signature sent!" });
    }
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
