const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const { createSite, getSites, generateQRToken, deleteSite } = require("./site");

// All routes require authentication
router.use(authMiddleware);

// GET /sites - List all sites for org
router.get("/", getSites);

// POST /sites - Create a new site (Admin only)
router.post("/", createSite);

// GET /sites/:siteId/qr - Generate QR token for a site
router.get("/:siteId/qr", generateQRToken);

// DELETE /sites/:siteId - Delete a site (Admin only)
router.delete("/:siteId", deleteSite);

module.exports = router;
