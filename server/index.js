const express = require('express');
const routes = require('./controller/routes');
const errorHandler = require('./utils/errorHandler');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Required for express-rate-limit when behind a proxy (e.g. Vercel)
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Vighnotech API Server' });
});

app.use(errorHandler);

module.exports = app;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
