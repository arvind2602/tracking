const express = require('express');
const organization = express.Router();
const organizationController = require('./organization');
const authMiddleware = require('../../middleware/authMiddleware');

// Public Route
organization.post('/register', organizationController.registerOrganization);

const { upload } = require('../../middleware/uploadMiddleware');

// Protected Routes
organization.use(authMiddleware);
organization.get('/settings', organizationController.getOrganizationSettings);
organization.put('/settings', upload.single('logo'), organizationController.updateOrganizationSettings);

// HR holiday management (dedicated endpoints with reason support)
const holidaysController = require('./holidays');
organization.get('/holidays', holidaysController.getHolidays);
organization.post('/holidays', holidaysController.addHoliday);
organization.delete('/holidays/:key', holidaysController.deleteHoliday);

module.exports = organization;