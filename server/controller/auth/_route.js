const express = require('express');
const employee = express.Router();
const employeeController = require('./auth');
const authMiddleware = require('../../middleware/authMiddleware');
const activityMiddleware = require('../../middleware/activityMiddleware');

employee.post('/login', employeeController.login);

// Forgot password OTP flow (public) - send OTP if email exists and not archived
employee.post('/forgot-password', employeeController.forgotPassword);
employee.post('/forget-password', employeeController.forgetPassword); // alias
employee.post('/verify-otp', employeeController.verifyOtp);
employee.post('/reset-password', employeeController.resetPassword);
employee.post('/verify-reset-token', employeeController.verifyResetToken); // legacy link flow

// Device tracking routes (no auth required for first-time device setup)
employee.post('/device/primary', authMiddleware, employeeController.setPrimaryDevice);
employee.post('/device/check-change', authMiddleware, employeeController.checkDeviceChange);

// Protected Routes
employee.use(authMiddleware);
employee.get('/organization', employeeController.getEmployeesByOrg);
employee.get('/organization/employees', employeeController.getEmployeesByOrg);
employee.get('/archived', employeeController.getArchivedEmployees);
employee.get('/export', employeeController.exportUsers);
employee.get('/skills', employeeController.getSkills);
employee.post('/register', employeeController.register);
employee.get('/profile', employeeController.getEmployee);
employee.get('/:id', employeeController.getEmployeeById);
employee.patch('/:id/restore', employeeController.restoreEmployee);
employee.delete('/:id/permanent', employeeController.permanentlyDeleteEmployee);

employee.use(activityMiddleware);
const { upload } = require('../../middleware/uploadMiddleware');
employee.put('/:id', upload.single('image'), employeeController.updateEmployee);
employee.put('/:id/change-password', employeeController.changePassword);
employee.delete('/:id', employeeController.deleteEmployee);

module.exports = employee;