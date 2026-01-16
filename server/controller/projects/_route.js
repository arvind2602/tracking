const express = require('express');
const projects = express.Router();
const projectsController = require('./projects');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all project routes
projects.use(authMiddleware);

// In your router file
projects.post('/', projectsController.createProject);
projects.get('/export', projectsController.exportProjects);
projects.get('/', projectsController.getProjects);
projects.put('/priority/update', projectsController.updateProjectsPriority); // Must come before /:id
projects.get('/:id/export', projectsController.exportProjectTasks);
projects.get('/:id', projectsController.getProject);
projects.put('/:id', projectsController.updateProject);
projects.delete('/:id', projectsController.deleteProject);

module.exports = projects;