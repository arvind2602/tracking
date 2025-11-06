const express = require('express');
const task = express.Router();
const taskController = require('./task');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all task routes
task.use(authMiddleware);
// In your router file
task.post('/', taskController.createTask);
task.get('/tasks/:id', taskController.getTask);
task.get('/projects/:projectId/tasks', taskController.getTasksByProject);
task.put('/tasks/:id', taskController.updateTask);
task.delete('/tasks/:id', taskController.deleteTask);
task.post('/comments/:taskId', taskController.createComment);
task.get('/comments/:taskId', taskController.getCommentsByTask);
task.get('/employees/tasks', taskController.getTaskByEmployee);
task.put('/assign/:id', taskController.assignTask);
task.put('/status/:id', taskController.changeTaskStatus);
task.get('/user/:id', taskController.getTasksPerEmployee);

module.exports = task;