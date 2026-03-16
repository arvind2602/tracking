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
 * @route DELETE /api/qr/locations/:id
 * @desc Delete a QR location
 */
qrVerification.delete('/locations/:id', authMiddleware, qrController.deleteLocation);

/**
 * @route GET /api/qr/visits
 * @desc Get visit history
 */
qrVerification.get('/visits', authMiddleware, qrController.getVisits);

/**
 * @route GET /api/qr/spatial-tree
 * @desc Get hierarchical spatial data
 */
qrVerification.get('/spatial-tree', authMiddleware, qrController.getSpatialTree);

/**
 * @route POST /api/qr/buildings
 */
qrVerification.post('/buildings', authMiddleware, qrController.createBuilding);

/**
 * @route POST /api/qr/floors
 */
qrVerification.post('/floors', authMiddleware, qrController.createFloor);

/**
 * @route POST /api/qr/zones
 */
qrVerification.post('/zones', authMiddleware, qrController.createZone);

module.exports = qrVerification;
