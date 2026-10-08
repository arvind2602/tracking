const express = require('express');
const summary = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const httpCache = require('../../utils/httpCache');
const ctrl = require('./summary');

summary.use(authMiddleware);
// Weekly summary = 13 queries recomputed per hit; cache GETs for 60s.
summary.use(httpCache(60_000));
summary.get('/weekly', ctrl.getWeeklySummary);
summary.get('/preview', ctrl.getWeeklyPreview);
summary.post('/send', ctrl.sendWeeklyToOptedIn);

module.exports = summary;
