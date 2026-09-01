const express = require('express');
const cron = express.Router();
const ctrl = require('./cron');

// No authMiddleware — secret validated inside handler; supports GET (cron-job.com default) and POST
cron.get('/weekly-summary', ctrl.triggerWeeklyCron);
cron.post('/weekly-summary', ctrl.triggerWeeklyCron);

module.exports = cron;
