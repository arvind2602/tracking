const express = require('express');
const performance = express.Router();
const performanceController = require('./performance');
const dashboardConsolidated = require('./dashboardConsolidated');
const { getLoginPopupData } = require('./loginPopupData');
const authMiddleware = require('../../middleware/authMiddleware');
const httpCache = require('../../utils/httpCache');

// Apply authentication middleware to all report routes
performance.use(authMiddleware);

// Dashboards fan out 10-15 queries per hit — 30s server-side cache keeps the
// landing page fast while staying fresh enough for day-to-day use.
performance.use(httpCache(30_000));

// CONSOLIDATED ENDPOINT - Single API call for entire dashboard
performance.get('/dashboard-all', dashboardConsolidated.getDashboardAll);

// Login popup data - star performer + personalized tips
performance.get('/login-popup-data', getLoginPopupData);

// Individual endpoints (kept for backwards compatibility)
performance.get('/average-task-completion-time', performanceController.getAverageTaskCompletionTime);
performance.get('/points-leaderboard', performanceController.getPointsLeaderboard);
performance.get('/productivity-trend', performanceController.getProductivityTrend);
performance.get('/monthly-productivity-trend', performanceController.getMonthlyProductivityTrend);
performance.get('/task-completion-rate', performanceController.getTaskCompletionRate);
performance.get('/recent-activity', performanceController.getRecentActivity);
performance.get('/dashboard-summary', performanceController.getDashboardSummary);
performance.get('/active-projects-this-week', performanceController.getActiveProjectsThisWeek);

module.exports = performance;
