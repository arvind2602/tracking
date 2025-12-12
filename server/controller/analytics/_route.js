const express = require('express');
const router = express.Router();
const { getProjectsAtRisk, getTaskInsights, getEmployeePerformance } = require('./analytics');
const authMiddleware = require('../../middleware/authMiddleware');


router.use(authMiddleware);
router.get('/projects-risk', getProjectsAtRisk);
router.get('/task-insights', getTaskInsights);
router.get('/employee-performance', getEmployeePerformance);

module.exports = router;
