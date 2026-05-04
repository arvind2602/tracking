const express = require('express');
const routes = require('../controller/routes');

const app = express();

// Trust proxy (Vercel)
app.set('trust proxy', 1);

// ✅ GLOBAL CORS (ALLOW ALL)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-institute-id, x-organization-id'
  );
  res.header('Access-Control-Allow-Credentials', 'true');

  // ✅ Handle preflight immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler (still returns CORS headers)
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');

  console.error(err);

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;