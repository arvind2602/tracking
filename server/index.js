const express = require('express');
const routes = require('./controller/routes');
const errorHandler = require('./utils/errorHandler');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: true, // Reflect the request origin to allow all origins with credentials
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Accept', 
        'X-Requested-With', 
        'Origin',
        'x-institute-id',
        'x-api-key'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight for all routes
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
