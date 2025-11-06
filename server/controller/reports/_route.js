const express = require('express');
const reports = express.Router();
const reportsController = require('./reports');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all report routes
reports.use(authMiddleware);

reports.get('/role-distribution', reportsController.getRoleDistribution);
reports.get('/task-points', reportsController.getTaskPoints);
reports.get('/tasks-by-status', reportsController.getTasksByStatus);
reports.get('/tasks-per-employee', reportsController.getTasksPerEmployee);
reports.get('/employee-count-per-org', reportsController.getEmployeeCountPerOrg);
reports.get('/projects-per-org', reportsController.getActiveVsArchivedEmployees);
reports.get('/active-vs-archived-employees', reportsController.getActiveVsArchivedEmployees);

module.exports = reports;