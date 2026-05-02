const express = require('express');
const routes = require('./controller/routes');
const errorHandler = require('./utils/errorHandler');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) 
    : [];

const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Accept', 
        'X-Requested-With', 
        'Origin',
        'x-institute-id',
        'x-api-key',
        'X-API-Key',
        'Access-Control-Allow-Headers',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'Cache-Control',
        'Pragma',
        'If-Modified-Since'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions)); // Handle preflight for all routes (Express 5 compatible)
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
