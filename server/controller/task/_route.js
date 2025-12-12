const express = require('express');
const task = express.Router();
const taskController = require('./task');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all task routes
task.use(authMiddleware);

task.post('/', taskController.createTask);
task.get('/export', taskController.exportTasks);
task.get('/:id', taskController.getTask);
task.get('/projects/:projectId/tasks', taskController.getTasksByProject);
task.put('/:id', taskController.updateTask);
task.delete('/:id', taskController.deleteTask);
task.post('/comments/:taskId', taskController.createComment);
task.get('/comments/:taskId', taskController.getCommentsByTask);
task.get('/employees/tasks', taskController.getTaskByEmployee);
task.put('/assign/:id', taskController.assignTask);
task.put('/:id/status', taskController.changeTaskStatus);
task.patch('/:id/status', taskController.changeTaskStatus);
task.put('/reorder', taskController.reorderTasks);
task.patch('/reorder', taskController.reorderTasks);
task.get('/user/:id', taskController.getTasksPerEmployee);

module.exports = task;