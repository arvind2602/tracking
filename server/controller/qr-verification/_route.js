const express = require('express');
const qrVerification = express.Router();
const qrController = require('./qrVerification');
const authMiddleware = require('../../middleware/authMiddleware');

/**
 * @route GET /api/qr/locations
 * @desc Get all QR locations for the current organization
 */
qrVerification.get('/locations', authMiddleware, qrController.getLocations);

/**
 * @route POST /api/qr/locations
 * @desc Create a new QR location
 */
qrVerification.post('/locations', authMiddleware, qrController.createLocation);

/**
 * @route POST /api/qr/verify
 * @desc Verify user presence at a QR location
 */
qrVerification.post('/verify', authMiddleware, qrController.verifyScan);

/**
 * @route GET /api/qr/visits
 * @desc Get visit history
 */
qrVerification.get('/visits', authMiddleware, qrController.getVisits);

module.exports = qrVerification;
