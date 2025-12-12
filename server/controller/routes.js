const express = require('express');
const organization = express.Router();
const projectsRoutes = require('./projects/_route');
const taskRoutes = require('./task/_route');
const authRoutes = require('./auth/_route');
const organizationRoutes = require('./organization/_route');
const reportsRoutes = require('./reports/_route');
const performanceRoutes = require('./performance/_route');
const analyticsRoutes = require('./analytics/_route');

// Mount sub-routers
organization.use('/projects', projectsRoutes);
organization.use('/tasks', taskRoutes);
organization.use('/auth', authRoutes);
organization.use('/organization', organizationRoutes);
organization.use('/reports', reportsRoutes);
organization.use('/performance', performanceRoutes);
organization.use('/analytics', analyticsRoutes);

module.exports = organization;