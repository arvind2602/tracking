const express = require('express');
const performance = express.Router();
const performanceController = require('./performance');
const dashboardConsolidated = require('./dashboardConsolidated');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all report routes
performance.use(authMiddleware);

// CONSOLIDATED ENDPOINT - Single API call for entire dashboard
performance.get('/dashboard-all', dashboardConsolidated.getDashboardAll);

// Individual endpoints (kept for backwards compatibility)
performance.get('/average-task-completion-time', performanceController.getAverageTaskCompletionTime);
performance.get('/points-leaderboard', performanceController.getPointsLeaderboard);
performance.get('/productivity-trend', performanceController.getProductivityTrend);
performance.get('/task-completion-rate', performanceController.getTaskCompletionRate);
performance.get('/recent-activity', performanceController.getRecentActivity);
performance.get('/dashboard-summary', performanceController.getDashboardSummary);

module.exports = performance;