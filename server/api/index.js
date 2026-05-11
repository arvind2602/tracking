const express = require('express');
const routes = require('../controller/routes');

const cors = require('cors');

const app = express();

// Trust proxy (Vercel)
app.set('trust proxy', 1);

// ✅ Robust CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins (logic similar to '*' but compliant with credentials)
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'x-institute-id', 
    'x-organization-id'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));


// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);


  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;