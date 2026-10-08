const express = require('express');
const router = express.Router();
const notifications = require('./notifications');
const authMiddleware = require('../../middleware/authMiddleware');

// Device token registration (authenticated users)
router.post('/devices', authMiddleware, notifications.registerDevice);
router.get('/devices', authMiddleware, notifications.listMyDevices);
router.delete('/devices', authMiddleware, notifications.unregisterDevice);

// Credential test (FCM dry-run) + manual broadcast — protected by CRON_SECRET
router.post('/test', notifications.requireCronSecret, notifications.testSend);
router.post('/broadcast', notifications.requireCronSecret, notifications.broadcast);

module.exports = router;
