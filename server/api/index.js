const express = require('express');
const routes = require('../controller/routes');
const errorHandler = require('../utils/errorHandler');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Required when behind Vercel proxy
app.set('trust proxy', 1);

// ✅ Proper CORS (single source of truth)
app.use(cors({
  origin: 'https://vigtask.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-institute-id',
    'x-organization-id'
  ]
}));

// ✅ Handle preflight globally
app.options('*', cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes (ONLY once)
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Vighnotech API Server' });
});

// ✅ Error handler (must include CORS headers)
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://vigtask.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

// Local dev only
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;