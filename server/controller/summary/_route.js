const express = require('express');
const summary = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const ctrl = require('./summary');

summary.use(authMiddleware);
summary.get('/weekly', ctrl.getWeeklySummary);
summary.get('/preview', ctrl.getWeeklyPreview);
summary.post('/send', ctrl.sendWeeklyToOptedIn);

module.exports = summary;
