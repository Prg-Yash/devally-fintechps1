import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import razorpayRoutes from './routes/razorpay.routes';
import agreementRoutes from './routes/agreement.routes';
import ticketRoutes from './routes/ticket.routes';

dotenv.config();

const app = express();

// Global Middleware
app.use(cors({ origin: 'http://localhost:3000' }));

// Global JSON parsing generally goes here, but we excluded it because Webhooks need raw strings.
// To add regular JSON parsing for other routes without breaking webhooks, you can do:
// app.use((req, res, next) => {
//   if (req.originalUrl === '/razorpay/webhook') {
//     next(); // Skip JSON parsing
//   } else {
//     express.json()(req, res, next);
//   }
// });
// Or just let individual route files specify their parsers (as done in razorpay.routes.ts)

// API Routes mounting
app.use('/razorpay', razorpayRoutes);
app.use('/agreements', agreementRoutes);
app.use('/tickets', ticketRoutes);

// General health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

export default app;
