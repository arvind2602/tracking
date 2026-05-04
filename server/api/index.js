const express = require('express');
const routes = require('../controller/routes');
const errorHandler = require('../utils/errorHandler');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Required for express-rate-limit when behind a proxy (e.g. Vercel)
app.set("trust proxy", 1);

// Manual Permissive CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-institute-id, x-organization-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Vighnotech API Server' });
});

app.use(errorHandler);

// Only listen if not running as a serverless function (Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

module.exports = app;
