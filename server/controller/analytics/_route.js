const express = require('express');
const router = express.Router();
const { getProjectsAtRisk, getTaskInsights, getEmployeePerformance } = require('./analytics');
const authMiddleware = require('../../middleware/authMiddleware');
const httpCache = require('../../utils/httpCache');


router.use(authMiddleware);
// Analytics are derived aggregates — 60s server-side cache.
router.use(httpCache(60_000));
router.get('/projects-risk', getProjectsAtRisk);
router.get('/task-insights', getTaskInsights);
router.get('/employee-performance', getEmployeePerformance);

module.exports = router;
