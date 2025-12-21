const { pool } = require("../../config/db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Create a new site/checkpoint
 */
const createSite = async (req, res) => {
    try {
        const { name, description, latitude, longitude } = req.body;
        const organizationId = req.user.organization_uuid;

        if (!name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: "Name, latitude, and longitude are required." });
        }

        const result = await pool.query(
            `INSERT INTO "Site" ("name", "description", "latitude", "longitude", "organizationId", "createdAt")
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [name, description || null, latitude, longitude, organizationId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating site:", error);
        res.status(500).json({ message: "Failed to create site." });
    }
};

/**
 * Get all sites for the organization
 */
const getSites = async (req, res) => {
    try {
        const organizationId = req.user.organization_uuid;

        const result = await pool.query(
            `SELECT * FROM "Site" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`,
            [organizationId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching sites:", error);
        res.status(500).json({ message: "Failed to fetch sites." });
    }
};

/**
 * Generate a signed QR token for a site
 * The token contains encrypted site info that can be validated on scan
 */
const generateQRToken = async (req, res) => {
    try {
        const { siteId } = req.params;
        const organizationId = req.user.organization_uuid;

        // Verify site exists and belongs to org
        const siteResult = await pool.query(
            `SELECT * FROM "Site" WHERE "id" = $1 AND "organizationId" = $2`,
            [siteId, organizationId]
        );

        if (siteResult.rows.length === 0) {
            return res.status(404).json({ message: "Site not found." });
        }

        const site = siteResult.rows[0];

        // Create a signed token with site data
        const token = jwt.sign(
            {
                type: "SITE_QR",
                siteId: site.id,
                siteName: site.name,
                lat: site.latitude,
                lng: site.longitude,
                orgId: organizationId
            },
            JWT_SECRET,
            { expiresIn: "365d" } // Long-lived for printed QR codes
        );

        res.json({ token, site });
    } catch (error) {
        console.error("Error generating QR token:", error);
        res.status(500).json({ message: "Failed to generate QR token." });
    }
};

/**
 * Delete a site
 */
const deleteSite = async (req, res) => {
    try {
        const { siteId } = req.params;
        const organizationId = req.user.organization_uuid;

        const result = await pool.query(
            `DELETE FROM "Site" WHERE "id" = $1 AND "organizationId" = $2 RETURNING *`,
            [siteId, organizationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Site not found." });
        }

        res.json({ message: "Site deleted successfully." });
    } catch (error) {
        console.error("Error deleting site:", error);
        res.status(500).json({ message: "Failed to delete site." });
    }
};

module.exports = {
    createSite,
    getSites,
    generateQRToken,
    deleteSite
};
