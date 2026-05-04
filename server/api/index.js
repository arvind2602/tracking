const express = require('express');
const routes = require('../controller/routes');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Required when behind Vercel proxy
app.set('trust proxy', 1);

// ✅ CORS (primary)
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

// ✅ Hard fallback for OPTIONS (critical for Vercel edge cases)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', 'https://vigtask.vercel.app');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-institute-id, x-organization-id');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(200);
  }
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes (ONLY once)
app.use('/api', routes);

// Health route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Vighnotech API Server' });
});

// ✅ Error handler (must include CORS headers)
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://vigtask.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');

  console.error(err);

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;