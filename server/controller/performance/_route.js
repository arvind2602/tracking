const express = require('express');
const performance = express.Router();
const performanceController = require('./performance');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all report routes
performance.use(authMiddleware);

performance.get('/average-task-completion-time', performanceController.getAverageTaskCompletionTime);
performance.get('/points-leaderboard', performanceController.getPointsLeaderboard);
performance.get('/productivity-trend', performanceController.getProductivityTrend);
performance.get('/task-completion-rate', performanceController.getTaskCompletionRate);
performance.get('/recent-activity', performanceController.getRecentActivity);
performance.get('/dashboard-summary', performanceController.getDashboardSummary);

module.exports = performance;