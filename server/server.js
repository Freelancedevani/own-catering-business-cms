const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const connectDB = require('./config/db');
const errorMiddleware = require('./middleware/errorMiddleware');
const { globalLimiter } = require('./middleware/rateLimiter');

dotenv.config();

// Validate required env vars on startup
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL ERROR: ${key} is not defined in .env`);
    process.exit(1);
  }
});

connectDB();

const app = express();

// Security Middleware
app.use(helmet());
app.use(mongoSanitize());    // NoSQL injection protection
app.use(hpp());              // HTTP param pollution protection
app.use(compression());      // Gzip responses

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Global rate limiter
app.use('/api', globalLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/staff-wallet', require('./routes/staffWalletRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/ingredient-prices', require('./routes/ingredientPriceRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/auspicious-dates', require('./routes/auspiciousDateRoutes'));

// Handle unmatched routes
app.all('*', (req, res, next) => {
  const AppError = require('./utils/AppError');
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Global error handler (must be last)
app.use(errorMiddleware);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION 💥', err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION 💥', err.name, err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);
