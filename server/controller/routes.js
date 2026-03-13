const express = require('express');
const organization = express.Router();
const projectsRoutes = require('./projects/_route');
const taskRoutes = require('./task/_route');
const authRoutes = require('./auth/_route');
const organizationRoutes = require('./organization/_route');
const notesRoutes = require('./notes/_route');
const performanceRoutes = require('./performance/_route');
const analyticsRoutes = require('./analytics/_route');
const reportRoutes = require('./reports/_route');
const attendanceRoutes = require('./attendance/_route');
const qrRoutes = require('./qr-verification/_route');

// Mount sub-routers
organization.use('/projects', projectsRoutes);
organization.use('/tasks', taskRoutes);
organization.use('/notes', notesRoutes);
organization.use('/auth', authRoutes);
organization.use('/organization', organizationRoutes);
organization.use('/performance', performanceRoutes);
organization.use('/analytics', analyticsRoutes);
organization.use('/reports', reportRoutes);
organization.use('/attendance', attendanceRoutes);
organization.use('/qr', qrRoutes);

module.exports = organization;