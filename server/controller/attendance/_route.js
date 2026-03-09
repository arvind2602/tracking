const express = require('express');
const attendance = express.Router();
const attendanceController = require('./attendance');
const authMiddleware = require('../../middleware/authMiddleware');

// ==================== GEOFENCE MANAGEMENT ====================

// Get organization geofence settings
attendance.get('/geofence', authMiddleware, attendanceController.getOrganizationGeofence);

// Set organization geofence (enable/disable)
attendance.post('/geofence/set', authMiddleware, attendanceController.setOrganizationGeofence);

// ==================== CHECK-IN / CHECK-OUT ====================

attendance.post('/check-in', authMiddleware, attendanceController.checkIn);
attendance.post('/check-out', authMiddleware, attendanceController.checkOut);

// ==================== LEAVE REQUESTS ====================

// Submit leave request (creates note with tags)
attendance.post('/leave/request', authMiddleware, attendanceController.requestLeave);

// Get my leave requests
attendance.get('/leave/my-requests', authMiddleware, attendanceController.getMyLeaveRequests);

// Get all leave requests (admin)
attendance.get('/leave/requests', authMiddleware, attendanceController.getLeaveRequests);

// Approve/reject leave request
attendance.post('/leave/update', authMiddleware, attendanceController.updateLeaveRequest);

// ==================== ATTENDANCE HISTORY ====================

// Get employee attendance history
attendance.get('/history', authMiddleware, attendanceController.getAttendanceHistory);

// Get monthly summary
attendance.get('/summary/monthly', authMiddleware, attendanceController.getMonthlySummary);

// ==================== ADMIN ====================

// Get all organization attendance
attendance.get('/organization', authMiddleware, attendanceController.getOrganizationAttendance);

// ==================== SHIFT MANAGEMENT ====================

// Get shifts
attendance.get('/shifts', authMiddleware, attendanceController.getShifts);

// Create shift
attendance.post('/shifts', authMiddleware, attendanceController.createShift);

// Update shift
attendance.put('/shifts/:id', authMiddleware, attendanceController.updateShift);

// Delete shift
attendance.delete('/shifts/:id', authMiddleware, attendanceController.deleteShift);

// Assign shift to employee
attendance.post('/shifts/assign', authMiddleware, attendanceController.assignShiftToEmployee);

module.exports = attendance;
