const Joi = require('joi');
const pool = require('../../config/db');
const { BadRequestError, UnprocessableEntityError, NotFoundError, UnauthorizedError } = require('../../utils/errors');
const { uploadToCloudinary } = require('../../config/cloudinary');

// Create a new document template
const createDocumentTemplate = async (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid('OFFER_LETTER', 'JOINING_LETTER', 'PROMOTION_LETTER', 'TERMINATION_LETTER', 'APPRECIATION_LETTER', 'WARNING_LETTER', 'OTHER').required(),
        content: Joi.string().required(),
        isDefault: Joi.boolean().default(false)
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { name, type, content, isDefault } = req.body;
    const organizationId = req.user.organization_uuid;
    const createdBy = req.user.user_uuid;

    try {
        // Check if user has HR privileges
        if (!req.user.is_hr && req.user.role !== 'ADMIN') {
            return next(new UnauthorizedError('HR privileges required'));
        }

        // If setting as default, unset other defaults of same type
        if (isDefault) {
            await pool.query(
                'UPDATE "DocumentTemplate" SET "isDefault" = false WHERE "organizationId" = $1 AND type = $2',
                [organizationId, type]
            );
        }

        const result = await pool.query(
            `INSERT INTO "DocumentTemplate" (name, type, content, "organizationId", "createdBy", "isDefault")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, type, "isDefault", "createdAt"`,
            [name, type, content, organizationId, createdBy, isDefault]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Get all document templates for organization
const getDocumentTemplates = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;
    const { type } = req.query;

    try {
        let query = 'SELECT id, name, type, "isDefault", "createdAt", "updatedAt" FROM "DocumentTemplate" WHERE "organizationId" = $1';
        const params = [organizationId];

        if (type) {
            query += ' AND type = $2';
            params.push(type);
        }

        query += ' ORDER BY "createdAt" DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};

// Get specific document template
const getDocumentTemplateById = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            'SELECT id, name, type, content, "isDefault", "createdAt", "updatedAt" FROM "DocumentTemplate" WHERE id = $1 AND "organizationId" = $2',
            [id, organizationId]
        );

        if (result.rowCount === 0) return next(new NotFoundError('Document template not found'));
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update document template
const updateDocumentTemplate = async (req, res, next) => {
    const { id } = req.params;
    const schema = Joi.object({
        name: Joi.string().optional(),
        content: Joi.string().optional(),
        isDefault: Joi.boolean().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { name, content, isDefault } = req.body;
    const organizationId = req.user.organization_uuid;

    try {
        // Check if user has HR privileges
        if (!req.user.is_hr && req.user.role !== 'ADMIN') {
            return next(new UnauthorizedError('HR privileges required'));
        }

        // Check if template exists and belongs to organization
        const templateCheck = await pool.query(
            'SELECT type FROM "DocumentTemplate" WHERE id = $1 AND "organizationId" = $2',
            [id, organizationId]
        );

        if (templateCheck.rowCount === 0) return next(new NotFoundError('Document template not found'));

        const templateType = templateCheck.rows[0].type;

        // If setting as default, unset other defaults of same type
        if (isDefault) {
            await pool.query(
                'UPDATE "DocumentTemplate" SET "isDefault" = false WHERE "organizationId" = $1 AND type = $2 AND id != $3',
                [organizationId, templateType, id]
            );
        }

        let query = 'UPDATE "DocumentTemplate" SET';
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            params.push(name);
            paramIndex++;
        }

        if (content !== undefined) {
            updates.push(`content = $${paramIndex}`);
            params.push(content);
            paramIndex++;
        }

        if (isDefault !== undefined) {
            updates.push(`"isDefault" = $${paramIndex}`);
            params.push(isDefault);
            paramIndex++;
        }

        if (updates.length === 0) {
            return next(new BadRequestError('No updates provided'));
        }

        query += ' ' + updates.join(', ') + ', "updatedAt" = NOW() WHERE id = $' + paramIndex + ' AND "organizationId" = $' + (paramIndex + 1) + ' RETURNING id, name, type, "isDefault", "updatedAt"';
        params.push(id, organizationId);

        const result = await pool.query(query, params);

        if (result.rowCount === 0) return next(new NotFoundError('Document template not found'));
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Delete document template
const deleteDocumentTemplate = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;

    try {
        // Check if user has HR privileges
        if (!req.user.is_hr && req.user.role !== 'ADMIN') {
            return next(new UnauthorizedError('HR privileges required'));
        }

        const result = await pool.query(
            'DELETE FROM "DocumentTemplate" WHERE id = $1 AND "organizationId" = $2 RETURNING id',
            [id, organizationId]
        );

        if (result.rowCount === 0) return next(new NotFoundError('Document template not found'));
        res.json({ message: 'Document template deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Generate document for employee
const generateDocument = async (req, res, next) => {
    const schema = Joi.object({
        templateId: Joi.string().uuid().required(),
        employeeId: Joi.string().uuid().required(),
        content: Joi.string().required(),
        status: Joi.string().valid('DRAFT', 'GENERATED', 'SENT', 'SIGNED', 'ARCHIVED').default('GENERATED'),
        notes: Joi.string().optional().allow(null, '')
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { templateId, employeeId, content, status, notes } = req.body;
    const organizationId = req.user.organization_uuid;
    const generatedBy = req.user.user_uuid;

    try {
        // Check if user has HR privileges
        if (!req.user.is_hr && req.user.role !== 'ADMIN') {
            return next(new UnauthorizedError('HR privileges required'));
        }

        // Verify template exists and belongs to organization
        const templateCheck = await pool.query(
            'SELECT type FROM "DocumentTemplate" WHERE id = $1 AND "organizationId" = $2',
            [templateId, organizationId]
        );

        if (templateCheck.rowCount === 0) return next(new NotFoundError('Document template not found'));

        const templateType = templateCheck.rows[0].type;

        // Verify employee exists and belongs to organization
        const employeeCheck = await pool.query(
            'SELECT id FROM employee WHERE id = $1 AND "organiationId" = $2 AND is_archived = false',
            [employeeId, organizationId]
        );

        if (employeeCheck.rowCount === 0) return next(new NotFoundError('Employee not found'));

        const result = await pool.query(
            `INSERT INTO "GeneratedDocument" ("templateId", "employeeId", type, content, "generatedBy", "organizationId", status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, "templateId", "employeeId", type, status, "generatedAt", notes`,
            [templateId, employeeId, templateType, content, generatedBy, organizationId, status, notes || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Get all generated documents for organization
const getGeneratedDocuments = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;
    const { employeeId, type, status } = req.query;

    try {
        let query = `
            SELECT gd.id, gd."templateId", gd."employeeId", gd.type, gd.status, 
                   gd."generatedAt", gd.notes, gd."fileUrl",
                   e."firstName" as "employeeFirstName", e."lastName" as "employeeLastName",
                   dt.name as "templateName",
                   gbu."firstName" as "generatedByFirstName", gbu."lastName" as "generatedByLastName"
            FROM "GeneratedDocument" gd
            LEFT JOIN employee e ON gd."employeeId" = e.id
            LEFT JOIN "DocumentTemplate" dt ON gd."templateId" = dt.id
            LEFT JOIN employee gbu ON gd."generatedBy" = gbu.id
            WHERE gd."organizationId" = $1
        `;

        const params = [organizationId];
        let paramIndex = 2;

        if (employeeId) {
            query += ` AND gd."employeeId" = $${paramIndex}`;
            params.push(employeeId);
            paramIndex++;
        }

        if (type) {
            query += ` AND gd.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (status) {
            query += ` AND gd.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ' ORDER BY gd."generatedAt" DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};

// Get specific generated document
const getGeneratedDocumentById = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT gd.id, gd."templateId", gd."employeeId", gd.type, gd.content, gd.status, 
                   gd."generatedAt", gd."updatedAt", gd.notes, gd."fileUrl",
                   e."firstName" as "employeeFirstName", e."lastName" as "employeeLastName", e.email as "employeeEmail",
                   dt.name as "templateName", dt.content as "templateContent",
                   gbu."firstName" as "generatedByFirstName", gbu."lastName" as "generatedByLastName"
            FROM "GeneratedDocument" gd
            LEFT JOIN employee e ON gd."employeeId" = e.id
            LEFT JOIN "DocumentTemplate" dt ON gd."templateId" = dt.id
            LEFT JOIN employee gbu ON gd."generatedBy" = gbu.id
            WHERE gd.id = $1 AND gd."organizationId" = $2`,
            [id, organizationId]
        );

        if (result.rowCount === 0) return next(new NotFoundError('Generated document not found'));
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update generated document
const updateGeneratedDocument = async (req, res, next) => {
    const { id } = req.params;
    const schema = Joi.object({
        content: Joi.string().optional(),
        status: Joi.string().valid('DRAFT', 'GENERATED', 'SENT', 'SIGNED', 'ARCHIVED').optional(),
        notes: Joi.string().optional().allow(null, '')
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { content, status, notes } = req.body;
    const organizationId = req.user.organization_uuid;

    try {
        // Check if user has HR privileges
        if (!req.user.is_hr && req.user.role !== 'ADMIN') {
            return next(new UnauthorizedError('HR privileges required'));
        }

        // Check if document exists and belongs to organization
        const docCheck = await pool.query(
            'SELECT id FROM "GeneratedDocument" WHERE id = $1 AND "organizationId" = $2',
            [id, organizationId]
        );

        if (docCheck.rowCount === 0) return next(new NotFoundError('Generated document not found'));

        let query = 'UPDATE "GeneratedDocument" SET';
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (content !== undefined) {
            updates.push(`content = $${paramIndex}`);
            params.push(content);
            paramIndex++;
        }

        if (status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex}`);
            params.push(notes || null);
            paramIndex++;
        }

        if (updates.length === 0) {
            return next(new BadRequestError('No updates provided'));
        }

        query += ' ' + updates.join(', ') + ', "updatedAt" = NOW() WHERE id = $' + paramIndex + ' AND "organizationId" = $' + (paramIndex + 1) + ' RETURNING id, "templateId", "employeeId", type, status, "updatedAt", notes';
        params.push(id, organizationId);

        const result = await pool.query(query, params);

        if (result.rowCount === 0) return next(new NotFoundError('Generated document not found'));
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Upload document file
const uploadDocumentFile = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;

    try {
        // Check if user has HR privileges
        if (!req.user.is_hr && req.user.role !== 'ADMIN') {
            return next(new UnauthorizedError('HR privileges required'));
        }

        if (!req.file) {
            return next(new BadRequestError('No file uploaded'));
        }

        // Check if document exists and belongs to organization
        const docCheck = await pool.query(
            'SELECT id FROM "GeneratedDocument" WHERE id = $1 AND "organizationId" = $2',
            [id, organizationId]
        );

        if (docCheck.rowCount === 0) return next(new NotFoundError('Generated document not found'));

        // Upload file to Cloudinary
        const fileUrl = await uploadToCloudinary(req.file, 'document');

        const result = await pool.query(
            'UPDATE "GeneratedDocument" SET "fileUrl" = $1, "updatedAt" = NOW() WHERE id = $2 AND "organizationId" = $3 RETURNING id, "fileUrl"',
            [fileUrl, id, organizationId]
        );

        if (result.rowCount === 0) return next(new NotFoundError('Generated document not found'));
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Get document statistics
const getDocumentStatistics = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT 
                COUNT(*) as totalDocuments,
                COUNT(*) FILTER (WHERE status = 'DRAFT') as draftCount,
                COUNT(*) FILTER (WHERE status = 'GENERATED') as generatedCount,
                COUNT(*) FILTER (WHERE status = 'SENT') as sentCount,
                COUNT(*) FILTER (WHERE status = 'SIGNED') as signedCount,
                COUNT(*) FILTER (WHERE status = 'ARCHIVED') as archivedCount,
                COUNT(DISTINCT type) as documentTypesCount,
                COUNT(DISTINCT "employeeId") as employeesWithDocuments
            FROM "GeneratedDocument"
            WHERE "organizationId" = $1`,
            [organizationId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Get default template for specific document type
const getDefaultTemplate = async (req, res, next) => {
    const { type } = req.params;
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            'SELECT id, name, type, content, "isDefault", "createdAt", "updatedAt" FROM "DocumentTemplate" WHERE "organizationId" = $1 AND type = $2 AND "isDefault" = true ORDER BY "createdAt" DESC LIMIT 1',
            [organizationId, type]
        );

        if (result.rowCount === 0) {
            return next(new NotFoundError('No default template found for this type'));
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDocumentTemplate,
    getDocumentTemplates,
    getDocumentTemplateById,
    updateDocumentTemplate,
    deleteDocumentTemplate,
    generateDocument,
    getGeneratedDocuments,
    getGeneratedDocumentById,
    updateGeneratedDocument,
    uploadDocumentFile,
    getDocumentStatistics,
    getDefaultTemplate
};