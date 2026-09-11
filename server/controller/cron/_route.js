const express = require('express');
const cron = express.Router();
const ctrl = require('./cron');
const backlogCtrl = require('../backlog/backlog');

// No authMiddleware — secret validated inside handler; supports GET (cron-job.com default) and POST
cron.get('/weekly-summary', ctrl.triggerWeeklyCron);
cron.post('/weekly-summary', ctrl.triggerWeeklyCron);

// Backlog: morning employee reminders + evening HR defaulter reports.
// Suggested schedules (IST): reminder Fri+Sat 09:00, HR report Fri+Sat 19:30.
// Handlers self-skip when today is not the reminder day (unless ?force=true).
cron.get('/backlog-reminder', backlogCtrl.triggerBacklogReminder);
cron.post('/backlog-reminder', backlogCtrl.triggerBacklogReminder);
cron.get('/backlog-hr-report', backlogCtrl.triggerBacklogHrReport);
cron.post('/backlog-hr-report', backlogCtrl.triggerBacklogHrReport);

module.exports = cron;
