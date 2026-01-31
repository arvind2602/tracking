const express = require('express');
const employee = express.Router();
const employeeController = require('./auth');
const authMiddleware = require('../../middleware/authMiddleware');
const activityMiddleware = require('../../middleware/activityMiddleware');

employee.post('/login', employeeController.login);

employee.post('/forget-password', employeeController.forgetPassword);

// Protected Routes
employee.use(authMiddleware);
employee.get('/organization', employeeController.getEmployeesByOrg);
employee.get('/organization/employees', employeeController.getEmployeesByOrg);
employee.get('/export', employeeController.exportUsers);
employee.get('/skills', employeeController.getSkills);
employee.post('/register', employeeController.register);
employee.get('/profile', employeeController.getEmployee);
employee.get('/:id', employeeController.getEmployeeById);

employee.use(activityMiddleware);
const upload = require('../../middleware/uploadMiddleware');
employee.put('/:id', upload.single('image'), employeeController.updateEmployee);
employee.put('/:id/change-password', employeeController.changePassword);
employee.delete('/:id', employeeController.deleteEmployee);

module.exports = employee;