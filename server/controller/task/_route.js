const express = require('express');
const task = express.Router();
const taskController = require('./task');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all task routes
task.use(authMiddleware);

task.post('/', taskController.createTask);

// Specific routes MUST come before generic :id routes
task.get('/export', taskController.exportTasks);
task.get('/projects/:projectId/tasks', taskController.getTasksByProject);
task.get('/comments/:taskId', taskController.getCommentsByTask);
task.post('/comments/:taskId', taskController.createComment);
task.get('/employees/tasks', taskController.getTaskByEmployee);
task.get('/user/:id', taskController.getTasksPerEmployee);
task.put('/assign/:id', taskController.assignTask);
task.put('/reorder', taskController.reorderTasks);
task.patch('/reorder', taskController.reorderTasks);

// Status change routes - must be before generic /:id
task.put('/:id/status', taskController.changeTaskStatus);
task.patch('/:id/status', taskController.changeTaskStatus);

// Generic :id routes MUST come last
task.get('/:id', taskController.getTask);
task.put('/:id', taskController.updateTask);
task.delete('/:id', taskController.deleteTask);

module.exports = task;
