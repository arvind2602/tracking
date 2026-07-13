const express = require('express');
const attendance = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const leaveController = require('./leave');

// ==================== LEAVE REQUESTS ====================

// Submit leave request
attendance.post('/leave/apply', authMiddleware, leaveController.applyLeave);

// Get my leave requests
attendance.get('/leave/my', authMiddleware, leaveController.getMyLeaves);

// Get all leave requests (admin)
attendance.get('/leave/org', authMiddleware, leaveController.getOrgLeaves);

// Approve/reject leave request
attendance.patch('/leave/:id/status', authMiddleware, leaveController.updateLeaveStatus);

module.exports = attendance;
