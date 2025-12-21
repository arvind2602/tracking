const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getLogs, scanQR } = require('./attendance');
const authMiddleware = require('../../middleware/authMiddleware');

router.post('/checkin', authMiddleware, checkIn);
router.post('/checkout', authMiddleware, checkOut);
router.get('/history', authMiddleware, getLogs);
router.post('/scan', authMiddleware, scanQR);

module.exports = router;
