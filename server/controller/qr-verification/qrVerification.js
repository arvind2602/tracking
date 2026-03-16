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
 * Get all spatial data (Buildings -> Floors -> Zones)
 */
const getSpatialTree = async (req, res, next) => {
    const orgId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT 
                b.id as building_id, b.name as building_name, b.latitude, b.longitude,
                f.id as floor_id, f.level, f.name as floor_name, f."mapImageUrl",
                z.id as zone_id, z.name as zone_name, z."type" as zone_type, z.x, z.y,
                q.id as qr_id
             FROM building b
             LEFT JOIN floor f ON f."buildingId" = b.id
             LEFT JOIN zone z ON z."floorId" = f.id
             LEFT JOIN qr_location q ON q."zoneId" = z.id
             WHERE b."organizationId" = $1
             ORDER BY b.name, f.level, z.name`,
            [orgId]
        );

        // Organize into a tree structure
        const buildings = {};
        result.rows.forEach(row => {
            if (!buildings[row.building_id]) {
                buildings[row.building_id] = {
                    id: row.building_id,
                    name: row.building_name,
                    lat: row.latitude,
                    lng: row.longitude,
                    floors: {}
                };
            }

            if (row.floor_id && !buildings[row.building_id].floors[row.floor_id]) {
                buildings[row.building_id].floors[row.floor_id] = {
                    id: row.floor_id,
                    level: row.level,
                    name: row.floor_name,
                    mapUrl: row.mapImageUrl,
                    zones: []
                };
            }

            if (row.zone_id) {
                buildings[row.building_id].floors[row.floor_id].zones.push({
                    id: row.zone_id,
                    name: row.zone_name,
                    type: row.zone_type,
                    x: row.x,
                    y: row.y,
                    qrId: row.qr_id
                });
            }
        });

        res.json(Object.values(buildings).map(b => ({
            ...b,
            floors: Object.values(b.floors)
        })));
    } catch (error) {
        next(error);
    }
};

/**
 * Create a building
 */
const createBuilding = async (req, res, next) => {
    const orgId = req.user.organization_uuid;
    const { name, address, latitude, longitude } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO building (name, address, latitude, longitude, "organizationId")
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, address, parseFloat(latitude) || 0, parseFloat(longitude) || 0, orgId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('ERROR: createBuilding failed', error);
        next(error);
    }
};

/**
 * Create a floor
 */
const createFloor = async (req, res, next) => {
    const { buildingId, level, name, mapImageUrl } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO floor (level, name, "mapImageUrl", "buildingId")
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [parseInt(level) || 0, name, mapImageUrl, buildingId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('ERROR: createFloor failed', error);
        next(error);
    }
};

/**
 * Create a zone and optionally link a QR location
 */
const createZone = async (req, res, next) => {
    const { floorId, name, type, x, y, qrLocationId } = req.body;
    
    if (!floorId || floorId.length < 32) {
        return next(new BadRequestError('Valid Floor selection is required'));
    }
    if (!name || name.trim() === '') {
        return next(new BadRequestError('Zone name is required'));
    }

    // Map frontend types to Prisma Enum values
    const typeMapping = {
        'ROOM': 'MEETING_ROOM',
        'OFFICE': 'WORKSPACE',
        'TRANSIT': 'HALLWAY',
        'ENTRANCE': 'ENTRY_EXIT',
        'OTHER': 'OTHER'
    };
    
    const zoneType = typeMapping[(type || 'OFFICE').toUpperCase()] || 'WORKSPACE';
    const posX = parseFloat(x);
    const posY = parseFloat(y);

    if (isNaN(posX) || isNaN(posY)) {
        return next(new BadRequestError('Invalid coordinates'));
    }

    console.log('DEBUG: Validated Params:', { name, zoneType, posX, posY, floorId, qrLocationId });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const zoneRes = await client.query(
            `INSERT INTO zone (name, "type", x, y, "floorId")
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, zoneType, posX, posY, floorId]
        );
        const zone = zoneRes.rows[0];

        if (qrLocationId && qrLocationId.trim() !== '') {
            await client.query(
                `UPDATE qr_location SET "zoneId" = $1 WHERE id = $2`,
                [zone.id, qrLocationId]
            );
        }

        await client.query('COMMIT');
        res.json(zone);
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('ERROR: createZone failed', {
            message: error.message,
            detail: error.detail,
            code: error.code,
            params: { floorId, name, zoneType, posX, posY, qrLocationId }
        });
        next(error);
    } finally {
        if (client) client.release();
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

        // Fetch indoor context if linked to a zone
        const indoorRes = await client.query(
            `SELECT z.name as zone_name, f.name as floor_name, f.level, b.name as building_name
             FROM qr_location q
             JOIN zone z ON q."zoneId" = z.id
             JOIN floor f ON z."floorId" = f.id
             JOIN building b ON f."buildingId" = b.id
             WHERE q.id = $1`,
            [location_id]
        );

        const indoorContext = indoorRes.rowCount > 0 ? indoorRes.rows[0] : null;
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

        // --- PRODUCTION SECURITY: Anti-Spoofing & Rate Limiting ---
        const lastScanResult = await client.query(
            `SELECT timestamp FROM qr_visit WHERE "employeeId" = $1 ORDER BY timestamp DESC LIMIT 1`,
            [user_uuid]
        );

        if (lastScanResult.rowCount > 0) {
            const lastScanTime = new Date(lastScanResult.rows[0].timestamp);
            const secondsSinceLastScan = (new Date() - lastScanTime) / 1000;
            if (secondsSinceLastScan < 30) { // 30-second cooldown
                return res.status(429).json({
                    success: false,
                    message: `Rate limit exceeded. Please wait ${Math.round(30 - secondsSinceLastScan)}s.`,
                    error: 'RATE_LIMIT'
                });
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

        // --- PRODUCTION FEATURE: Attendance Integration ---
        // If valid, also mark user as present in the main attendance table if not already checked in
        if (isValid) {
            const today = new Date().toISOString().split('T')[0];
            const checkInRes = await client.query(
                `INSERT INTO attendance ("employeeId", date, "checkIn", status, location, "withinGeofence")
                 VALUES ($1, $2, NOW(), 'PRESENT', $3, true)
                 ON CONFLICT ("employeeId", date) DO UPDATE 
                 SET "checkOut" = CASE WHEN attendance."checkIn" IS NOT NULL THEN NOW() ELSE attendance."checkOut" END
                 WHERE attendance.date = $2`,
                [user_uuid, today, location.name]
            );
        }

        await client.query('COMMIT');

        if (!isValid) {
            return res.status(403).json({
                success: false,
                message: `Verification failed. You are ${Math.round(distance - location.radius)}m outside the authorized area.`,
                distance: Math.round(distance),
                isValid: false,
                deviceMismatch
            });
        }

        res.json({
            success: true,
            message: indoorContext
                ? `Located: ${indoorContext.building_name} > ${indoorContext.floor_name} > ${indoorContext.zone_name}`
                : 'Location verified successfully. Attendance recorded.',
            visit: visitResult.rows[0],
            isValid: true,
            indoor: indoorContext,
            deviceMismatch
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * Delete a QR location
 */
const deleteLocation = async (req, res, next) => {
    const { id } = req.params;
    const orgId = req.user.organization_uuid;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify ownership first
        const checkResult = await client.query(
            `SELECT id FROM qr_location WHERE id = $1 AND "organizationId" = $2`,
            [id, orgId]
        );

        if (checkResult.rowCount === 0) {
            throw new NotFoundError('Location not found or unauthorized');
        }

        // 1. Delete associated visits first (foreign key constraint)
        await client.query(
            `DELETE FROM qr_visit WHERE "locationId" = $1`,
            [id]
        );

        // 2. Delete the location
        await client.query(
            `DELETE FROM qr_location WHERE id = $1`,
            [id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Location and history deleted' });
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
    getVisits,
    getSpatialTree,
    createBuilding,
    createFloor,
    createZone,
    createLocation,
    verifyScan,
    deleteLocation
};
