const Joi = require('joi');
const { pool } = require('../../config/db');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Get all QR locations for the current organization
 */
const getLocations = async (req, res, next) => {
    const orgId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT id, name, latitude, longitude, radius, "createdAt"
             FROM qr_location
             WHERE "organizationId" = $1
             ORDER BY "createdAt" DESC`,
            [orgId]
        );

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new QR location
 */
const createLocation = async (req, res, next) => {
    const orgId = req.user.organization_uuid;
    const schema = Joi.object({
        name: Joi.string().required(),
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        radius: Joi.number().default(50),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { name, latitude, longitude, radius } = value;

    try {
        const result = await pool.query(
            `INSERT INTO qr_location (name, latitude, longitude, radius, "organizationId")
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, latitude, longitude, radius`,
            [name, latitude, longitude, radius, orgId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

/**
 * Verify user presence at a QR location
 */
const verifyScan = async (req, res, next) => {
    const { user_uuid } = req.user;
    const { location_id, device_id, timestamp, user_gps } = req.body;

    const schema = Joi.object({
        location_id: Joi.string().uuid().required(),
        device_id: Joi.string().required(),
        timestamp: Joi.date().iso().required(),
        user_gps: Joi.object({
            lat: Joi.number().required(),
            lng: Joi.number().required(),
        }).required(),
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch location details
        const locResult = await client.query(
            `SELECT latitude, longitude, radius FROM qr_location WHERE id = $1`,
            [location_id]
        );

        if (locResult.rowCount === 0) {
            throw new NotFoundError('Location not found');
        }

        const location = locResult.rows[0];
        const distance = calculateDistance(
            user_gps.lat,
            user_gps.lng,
            location.latitude,
            location.longitude
        );

        const isValid = distance <= location.radius;

        // Check for device mismatch (fetch primary device)
        const primaryDeviceResult = await client.query(
            `SELECT "deviceId" FROM device WHERE "employeeId" = $1 AND "isPrimary" = true`,
            [user_uuid]
        );

        let deviceMismatch = false;
        if (primaryDeviceResult.rowCount > 0) {
            if (primaryDeviceResult.rows[0].deviceId !== device_id) {
                deviceMismatch = true;
            }
        }

        // 2. Log the visit
        const visitResult = await client.query(
            `INSERT INTO qr_visit ("locationId", "employeeId", "deviceId", timestamp, "userLat", "userLng", distance, "isValid", "deviceMismatch")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, "isValid", distance, "deviceMismatch"`,
            [
                location_id,
                user_uuid,
                device_id,
                new Date(timestamp),
                user_gps.lat,
                user_gps.lng,
                distance,
                isValid,
                deviceMismatch
            ]
        );

        await client.query('COMMIT');

        if (!isValid) {
            return res.status(403).json({
                success: false,
                message: `Verification failed. You are ${Math.round(distance - location.radius)}m outside the authorized area.`,
                distance: Math.round(distance),
                isValid: false
            });
        }

        res.json({
            success: true,
            message: 'Location verified successfully',
            visit: visitResult.rows[0],
            isValid: true
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * Get visit history for the organization
 */
const getVisits = async (req, res, next) => {
    const orgId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT v.id, v.timestamp, v."userLat", v."userLng", v.distance, v."isValid", v."deviceId", v."deviceMismatch",
                    l.name as "locationName",
                    e."firstName", e."lastName", e.email
             FROM qr_visit v
             JOIN qr_location l ON v."locationId" = l.id
             JOIN employee e ON v."employeeId" = e.id
             WHERE l."organizationId" = $1
             ORDER BY v.timestamp DESC`,
            [orgId]
        );

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getLocations,
    createLocation,
    verifyScan,
    getVisits,
};
