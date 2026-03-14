import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import razorpayRoutes from './routes/razorpay.routes';
import agreementRoutes from './routes/agreement.routes';
import ticketRoutes from './routes/ticket.routes';
import adminRoutes from './routes/admin.routes';

dotenv.config();

const app = express();

// Global Middleware
app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/],
  }),
);

// Global JSON parsing generally goes here, but we excluded it because Webhooks need raw strings.
// Parse JSON for all routes except Razorpay webhook which needs raw request body.
app.use((req, res, next) => {
  if (req.originalUrl === '/razorpay/webhook') {
    next();
    return;
  }
  express.json()(req, res, next);
});

// API Routes mounting
app.use('/razorpay', razorpayRoutes);
app.use('/agreements', agreementRoutes);
app.use('/tickets', ticketRoutes);
app.use('/admin', adminRoutes);

// General health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

export default app;
