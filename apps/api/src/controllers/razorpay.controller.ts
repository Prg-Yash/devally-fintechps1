import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { razorpay } from '../config/razorpay';
import { distributePccToWallet, getPccDistributorContractAddress } from '../config/pcc';

const INR_TO_PCC_RATE = Number(process.env.INR_TO_PCC_RATE ?? '1');

export const getPccConfig = async (_req: Request, res: Response) => {
  try {
    return res.json({
      contractAddress: getPccDistributorContractAddress() ?? null,
      conversionRate: INR_TO_PCC_RATE,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { amount, userId, walletAddress } = req.body;

    if (!amount || !userId || !walletAddress) {
      return res.status(400).json({ error: 'amount, userId, and walletAddress are required' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount must be greater than 0' });
    }

    const pccAmount = Number(amount) * INR_TO_PCC_RATE;

    const options = {
      amount: Math.round(amount * 100), // Convert INR to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        walletAddress,
        conversionType: 'INR_TO_PCC',
        pccAmount: pccAmount.toFixed(2),
      },
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
      pccAmount,
      conversionRate: INR_TO_PCC_RATE,
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
          status: 'PAYMENT_VERIFIED',
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ message: 'walletAddress is required' });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ message: 'Invalid walletAddress format' });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      const existingPurchase = await prisma.purchase.findUnique({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (!existingPurchase) {
        return res.status(404).json({ message: 'Purchase not found for this order id' });
      }

      if (existingPurchase.status === 'COMPLETED') {
        return res.status(200).json({ message: 'Payment already verified and PCC already delivered' });
      }

      const pccAmount = existingPurchase.amount * INR_TO_PCC_RATE;

      // Payment is authentic, update the DB synchronously
      await prisma.purchase.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'PAYMENT_VERIFIED',
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      const txHash = await distributePccToWallet(walletAddress as `0x${string}`, pccAmount);

      await prisma.purchase.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'COMPLETED',
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      console.log(`[Frontend Verification] Payment Done! Order: ${razorpay_order_id}`);
      return res.status(200).json({
        message: 'Payment verified and PCC transferred successfully',
        txHash,
        contractAddress: getPccDistributorContractAddress() ?? null,
      });
    } else {
      return res.status(400).json({ message: "Invalid signature sent!" });
    }
  } catch (error: any) {
    const maybeOrderId = req.body?.razorpay_order_id;
    if (maybeOrderId) {
      await prisma.purchase.updateMany({
        where: { razorpayOrderId: maybeOrderId, status: { not: 'COMPLETED' } },
        data: { status: 'TRANSFER_FAILED' },
      });
    }
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserPurchases = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const enriched = purchases.map((purchase) => {
      const pccAmount = purchase.amount * INR_TO_PCC_RATE;
      return {
        ...purchase,
        pccAmount,
        conversionRate: INR_TO_PCC_RATE,
        conversionType: 'INR_TO_PCC',
      };
    });

    res.json({ purchases: enriched });
  } catch (error: any) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
