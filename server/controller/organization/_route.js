const express = require('express');
const organization = express.Router();
const organizationController = require('./organization');
const authMiddleware = require('../../middleware/authMiddleware');

// Public Route
organization.post('/register', organizationController.registerOrganization);

// Protected Routes

// Additional protected routes can be added here

module.exports = organization;