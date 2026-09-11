const express = require('express');
const backlog = express.Router();
const ctrl = require('./backlog');
const authMiddleware = require('../../middleware/authMiddleware');

backlog.get('/my', authMiddleware, ctrl.getMyBacklog);
backlog.get('/preview', authMiddleware, ctrl.getBacklogPreview);

module.exports = backlog;
