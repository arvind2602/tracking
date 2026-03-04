const pool = require('../../config/db');
const Joi = require('joi');
const { BadRequestError, NotFoundError, AuthorizationError } = require('../../utils/errors');
const { withTransaction } = require('../../utils/queryBuilders');
const { uploadToCloudinary } = require('../../config/cloudinary');

// 1. Create Note
const createNote = async (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().required(),
        content: Joi.array().items(Joi.string().allow('')).default([]),
        type: Joi.string().valid('PERSONAL', 'ORGANIZATIONAL', 'PROJECT').required(),
        projectId: Joi.string().uuid().optional().allow(null),
        tags: Joi.array().items(Joi.string().uuid()).optional().default([]),
        attachments: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            fileType: Joi.string().required(),
            size: Joi.number().optional().allow(null),
            heading: Joi.string().optional().allow('', null)
        })).optional().default([]),
        links: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            heading: Joi.string().optional().allow('', null)
        })).optional().default([])
    });

    const { error, value } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { title, content, type, projectId, tags, attachments, links } = value;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;

    try {
        if (type === 'PROJECT' && !projectId) {
            return next(new BadRequestError('Project ID is required for PROJECT note type'));
        }

        if (type === 'ORGANIZATIONAL' && req.user.role !== 'ADMIN') {
            return next(new AuthorizationError('Only admins can create organizational notes'));
        }

        // Verify project belongs to org if type is PROJECT
        if (type === 'PROJECT') {
            const projectCheck = await pool.query(
                'SELECT id FROM projects WHERE id = $1 AND "organiationId" = $2',
                [projectId, organizationId]
            );
            if (projectCheck.rowCount === 0) return next(new NotFoundError('Project not found'));
        }

        const newNote = await withTransaction(pool.pool, async (client) => {
            // Insert Note
            const noteResult = await client.query(
                `INSERT INTO "Note" (title, content, type, "organizationId", "authorId", "projectId", "isPinned", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
           RETURNING *`,
                [title, content, type, organizationId, authorId, projectId || null]
            );
            const note = noteResult.rows[0];

            // Insert Tags
            if (tags && tags.length > 0) {
                for (const employeeId of tags) {
                    await client.query(
                        `INSERT INTO "NoteTag" ("noteId", "employeeId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                        [note.id, employeeId]
                    );
                }
            }

            // Insert Attachments
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    await client.query(
                        `INSERT INTO "NoteAttachment" ("noteId", name, url, "fileType", size, heading) VALUES ($1, $2, $3, $4, $5, $6)`,
                        [note.id, att.name, att.url, att.fileType, att.size || null, att.heading || null]
                    );
                }
            }

            // Insert Links
            if (links && links.length > 0) {
                for (const link of links) {
                    await client.query(
                        `INSERT INTO "NoteLink" ("noteId", name, url, heading) VALUES ($1, $2, $3, $4)`,
                        [note.id, link.name, link.url, link.heading || null]
                    );
                }
            }

            return note;
        });

        res.status(201).json(newNote);
    } catch (err) { next(err); }
};

// 2. Get Notes (List)
const getNotes = async (req, res, next) => {
    const { type, projectId, search, employeeId } = req.query;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;

    try {
        let whereClauses = [`n."organizationId" = $1`];
        let values = [organizationId];
        let paramIdx = 2;

        if (type === 'PERSONAL') {
            // Personal: only own notes OR notes where user is tagged
            // If employeeId is provided and requester is ADMIN, allow seeing that employee's personal notes
            const filterUserId = (employeeId && req.user.role === 'ADMIN') ? employeeId : authorId;
            whereClauses.push(`(n."authorId" = $${paramIdx} OR EXISTS (SELECT 1 FROM "NoteTag" nt WHERE nt."noteId" = n.id AND nt."employeeId" = $${paramIdx}::uuid))`);
            whereClauses.push(`n.type = 'PERSONAL'`);
            values.push(filterUserId);
            paramIdx++;
        } else if (type === 'ORGANIZATIONAL') {
            // Organizational: visible to all in org
            whereClauses.push(`n.type = 'ORGANIZATIONAL'`);
            if (employeeId) {
                whereClauses.push(`(n."authorId" = $${paramIdx} OR EXISTS (SELECT 1 FROM "NoteTag" nt WHERE nt."noteId" = n.id AND nt."employeeId" = $${paramIdx}::uuid))`);
                values.push(employeeId);
                paramIdx++;
            }
        } else if (type === 'PROJECT') {
            // Project: visible to all in org, filter by project if provided
            whereClauses.push(`n.type = 'PROJECT'`);
            if (projectId) {
                whereClauses.push(`n."projectId" = $${paramIdx}`);
                values.push(projectId);
                paramIdx++;
            }
            if (employeeId) {
                whereClauses.push(`(n."authorId" = $${paramIdx} OR EXISTS (SELECT 1 FROM "NoteTag" nt WHERE nt."noteId" = n.id AND nt."employeeId" = $${paramIdx}::uuid))`);
                values.push(employeeId);
                paramIdx++;
            }
        } else {
            // If no type specified, return ORG and PROJECT, plus PERSONAL where owner or tagged
            // If employeeId is specified, restrict to notes related to that employee
            if (employeeId) {
                whereClauses.push(`(n."authorId" = $${paramIdx} OR EXISTS (SELECT 1 FROM "NoteTag" nt WHERE nt."noteId" = n.id AND nt."employeeId" = $${paramIdx}::uuid))`);
                values.push(employeeId);
                paramIdx++;
            } else {
                whereClauses.push(`(n.type IN ('ORGANIZATIONAL', 'PROJECT') OR (n.type = 'PERSONAL' AND (n."authorId" = $${paramIdx} OR EXISTS (SELECT 1 FROM "NoteTag" nt WHERE nt."noteId" = n.id AND nt."employeeId" = $${paramIdx}::uuid))))`);
                values.push(authorId);
                paramIdx++;
            }
        }

        if (search) {
            whereClauses.push(`(n.title ILIKE $${paramIdx} OR EXISTS (SELECT 1 FROM unnest(n.content) AS c WHERE c ILIKE $${paramIdx}))`);
            values.push(`%${search}%`);
            paramIdx++;
        }

        const query = `
            SELECT n.*, 
                   e."firstName" as "authorFirstName", e."lastName" as "authorLastName",
                   p.name as "projectName",
                   (SELECT COUNT(*) FROM "NoteAttachment" na WHERE na."noteId" = n.id) as "attachmentCount"
            FROM "Note" n
            JOIN employee e ON n."authorId" = e.id
            LEFT JOIN projects p ON n."projectId" = p.id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY n."isPinned" DESC, n."createdAt" DESC
        `;

        const result = await pool.query(query, values);

        const notes = result.rows;

        if (notes.length > 0) {
            const noteIds = notes.map(n => n.id);
            const tagsRes = await pool.query(`
                SELECT nt.*, e."firstName", e."lastName", e.email 
                FROM "NoteTag" nt
                JOIN employee e ON nt."employeeId" = e.id
                WHERE nt."noteId" = ANY($1::uuid[])
            `, [noteIds]);

            const tags = tagsRes.rows;
            const attRes = await pool.query(`
                SELECT * FROM "NoteAttachment" WHERE "noteId" = ANY($1::uuid[])
            `, [noteIds]);
            const attachments = attRes.rows;

            const linksRes = await pool.query(`
                SELECT * FROM "NoteLink" WHERE "noteId" = ANY($1::uuid[])
            `, [noteIds]);
            const links = linksRes.rows;

            notes.forEach(note => {
                note.tags = tags.filter(t => t.noteId === note.id);
                note.attachments = attachments.filter(a => a.noteId === note.id);
                note.links = links.filter(l => l.noteId === note.id);
            });
        }

        res.json(notes);
    } catch (err) { next(err); }
};

// 3. Get Pinned Notes
const getPinnedNotes = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;

    try {
        // Auto-unpin expired notes
        try {
            await pool.query(`
                UPDATE "Note" 
                SET "isPinned" = false, "pinUntil" = NULL 
                WHERE "organizationId" = $1 AND "isPinned" = true AND "pinUntil" IS NOT NULL AND "pinUntil" < NOW()
            `, [organizationId]);
        } catch (updateErr) {
            console.error("Error auto-unpinning notes:", updateErr);
        }

        // Get currently pinned ORG notes
        const result = await pool.query(`
            SELECT n.*, e."firstName" as "authorFirstName", e."lastName" as "authorLastName"
            FROM "Note" n
            JOIN employee e ON n."authorId" = e.id
            WHERE n."organizationId" = $1 AND n."isPinned" = true AND n.type = 'ORGANIZATIONAL'
            ORDER BY n."updatedAt" DESC
        `, [organizationId]);

        res.json(result.rows);
    } catch (err) { next(err); }
};

// 4. Get Note By ID
const getNoteById = async (req, res, next) => {
    const { id } = req.params;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(`
            SELECT n.*, e."firstName" as "authorFirstName", e."lastName" as "authorLastName", p.name as "projectName"
            FROM "Note" n
            JOIN employee e ON n."authorId" = e.id
            LEFT JOIN projects p ON n."projectId" = p.id
            WHERE n.id = $1 AND n."organizationId" = $2
        `, [id, organizationId]);

        if (result.rowCount === 0) return next(new NotFoundError('Note not found'));

        const note = result.rows[0];

        // Access control check for personal notes
        if (note.type === 'PERSONAL' && note.authorId !== authorId) {
            const tagCheck = await pool.query(`SELECT 1 FROM "NoteTag" WHERE "noteId" = $1 AND "employeeId" = $2`, [id, authorId]);
            if (tagCheck.rowCount === 0) return next(new NotFoundError('Note not found'));
        }

        // Fetch attachments
        const attRes = await pool.query(`SELECT * FROM "NoteAttachment" WHERE "noteId" = $1`, [id]);
        note.attachments = attRes.rows;

        // Fetch links
        const linksRes = await pool.query(`SELECT * FROM "NoteLink" WHERE "noteId" = $1`, [id]);
        note.links = linksRes.rows;

        // Fetch tags
        const tagRes = await pool.query(`
            SELECT nt.*, e."firstName", e."lastName", e.email 
            FROM "NoteTag" nt
            JOIN employee e ON nt."employeeId" = e.id
            WHERE nt."noteId" = $1
        `, [id]);
        note.tags = tagRes.rows;

        res.json(note);
    } catch (err) { next(err); }
};

// 5. Update Note
const updateNote = async (req, res, next) => {
    const { id } = req.params;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;

    const schema = Joi.object({
        title: Joi.string().optional(),
        content: Joi.array().items(Joi.string()).optional(),
        type: Joi.string().valid('PERSONAL', 'ORGANIZATIONAL', 'PROJECT').optional(),
        projectId: Joi.string().uuid().optional().allow(null),
        tags: Joi.array().items(Joi.string().uuid()).optional(),
        attachments: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            fileType: Joi.string().required(),
            size: Joi.number().optional().allow(null),
            heading: Joi.string().optional().allow('', null)
        })).optional(),
        links: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            heading: Joi.string().optional().allow('', null)
        })).optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { title, content, type, projectId, tags, attachments, links } = value;

    try {
        const noteCheck = await pool.query(`SELECT "authorId" FROM "Note" WHERE id = $1 AND "organizationId" = $2`, [id, organizationId]);
        if (noteCheck.rowCount === 0) return next(new NotFoundError('Note not found'));

        // Only author (or maybe admin) can update
        if (noteCheck.rows[0].authorId !== authorId && req.user.role !== 'ADMIN') {
            return next(new AuthorizationError('Not authorized to update this note'));
        }

        if (type === 'ORGANIZATIONAL' && req.user.role !== 'ADMIN') {
            return next(new AuthorizationError('Only admins can change note type to organizational'));
        }

        const updatedNote = await withTransaction(pool.pool, async (client) => {
            let updateQuery = [];
            let updateValues = [];
            let paramIdx = 1;

            if (title !== undefined) { updateQuery.push(`title = $${paramIdx++}`); updateValues.push(title); }
            if (content !== undefined) { updateQuery.push(`content = $${paramIdx++}`); updateValues.push(content); }
            if (type !== undefined) { updateQuery.push(`type = $${paramIdx++}`); updateValues.push(type); }
            if (projectId !== undefined) { updateQuery.push(`"projectId" = $${paramIdx++}`); updateValues.push(projectId || null); }

            updateQuery.push(`"updatedAt" = NOW()`);

            let returnedNote;
            if (updateValues.length > 0) {
                updateValues.push(id);
                updateValues.push(organizationId);
                const q = `UPDATE "Note" SET ${updateQuery.join(', ')} WHERE id = $${paramIdx} AND "organizationId" = $${paramIdx + 1} RETURNING *`;
                const res = await client.query(q, updateValues);
                returnedNote = res.rows[0];
            } else {
                const res = await client.query(`SELECT * FROM "Note" WHERE id = $1`, [id]);
                returnedNote = res.rows[0];
            }

            // Sync Tags
            if (tags !== undefined) {
                await client.query(`DELETE FROM "NoteTag" WHERE "noteId" = $1`, [id]);
                if (tags.length > 0) {
                    for (const employeeId of tags) {
                        await client.query(
                            `INSERT INTO "NoteTag" ("noteId", "employeeId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                            [id, employeeId]
                        );
                    }
                }
            }

            // Sync Attachments
            if (attachments !== undefined) {
                await client.query(`DELETE FROM "NoteAttachment" WHERE "noteId" = $1`, [id]);
                if (attachments.length > 0) {
                    for (const att of attachments) {
                        await client.query(
                            `INSERT INTO "NoteAttachment" ("noteId", name, url, "fileType", size, heading) VALUES ($1, $2, $3, $4, $5, $6)`,
                            [id, att.name, att.url, att.fileType, att.size || null, att.heading || null]
                        );
                    }
                }
            }

            // Sync Links
            if (links !== undefined) {
                await client.query(`DELETE FROM "NoteLink" WHERE "noteId" = $1`, [id]);
                if (links.length > 0) {
                    for (const link of links) {
                        await client.query(
                            `INSERT INTO "NoteLink" ("noteId", name, url, heading) VALUES ($1, $2, $3, $4)`,
                            [id, link.name, link.url, link.heading || null]
                        );
                    }
                }
            }

            return returnedNote;
        });

        res.json(updatedNote);
    } catch (err) { next(err); }
};

// 6. Delete Note
const deleteNote = async (req, res, next) => {
    const { id } = req.params;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;

    try {
        const noteCheck = await pool.query(`SELECT "authorId" FROM "Note" WHERE id = $1 AND "organizationId" = $2`, [id, organizationId]);
        if (noteCheck.rowCount === 0) return next(new NotFoundError('Note not found'));

        if (noteCheck.rows[0].authorId !== authorId && req.user.role !== 'ADMIN') {
            return next(new AuthorizationError('Not authorized to delete this note'));
        }

        await pool.query(`DELETE FROM "Note" WHERE id = $1`, [id]);
        res.json({ message: 'Note deleted' });
    } catch (err) { next(err); }
};

// 7. Pin Note
const pinNote = async (req, res, next) => {
    const { id } = req.params;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;
    const isAdmin = req.user.role === 'ADMIN';

    const schema = Joi.object({
        duration: Joi.object({
            value: Joi.number().required(),
            unit: Joi.string().valid('hours', 'weeks', 'months', 'forever').required()
        }).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { duration } = value;

    try {
        const noteCheck = await pool.query(`SELECT "authorId", type FROM "Note" WHERE id = $1 AND "organizationId" = $2`, [id, organizationId]);
        if (noteCheck.rowCount === 0) return next(new NotFoundError('Note not found'));
        const note = noteCheck.rows[0];

        if (note.type === 'ORGANIZATIONAL' && !isAdmin) {
            return next(new AuthorizationError('Only admins can pin organizational notes'));
        }
        if (note.type === 'PERSONAL' && note.authorId !== authorId) {
            return next(new AuthorizationError('Not authorized to pin this note'));
        }

        let pinUntil = null;
        if (duration.unit !== 'forever') {
            const intervalMap = {
                'hours': 'hours',
                'weeks': 'weeks',
                'months': 'months'
            };
            const interval = `${duration.value} ${intervalMap[duration.unit]}`;
            const timeRes = await pool.query(`SELECT NOW() + INTERVAL '${interval}' as "pinUntil"`);
            pinUntil = timeRes.rows[0].pinUntil;
        }

        const result = await pool.query(`
            UPDATE "Note" SET "isPinned" = true, "pinUntil" = $1, "updatedAt" = NOW() 
            WHERE id = $2 RETURNING *
        `, [pinUntil, id]);

        res.json(result.rows[0]);
    } catch (err) { next(err); }
};

// 8. Unpin Note
const unpinNote = async (req, res, next) => {
    const { id } = req.params;
    const authorId = req.user.user_uuid;
    const organizationId = req.user.organization_uuid;
    const isAdmin = req.user.role === 'ADMIN';

    try {
        const noteCheck = await pool.query(`SELECT "authorId", type FROM "Note" WHERE id = $1 AND "organizationId" = $2`, [id, organizationId]);
        if (noteCheck.rowCount === 0) return next(new NotFoundError('Note not found'));
        const note = noteCheck.rows[0];

        if (note.type === 'ORGANIZATIONAL' && !isAdmin) {
            return next(new AuthorizationError('Only admins can unpin organizational notes'));
        }
        if (note.type === 'PERSONAL' && note.authorId !== authorId) {
            return next(new AuthorizationError('Not authorized to unpin this note'));
        }

        const result = await pool.query(`
            UPDATE "Note" SET "isPinned" = false, "pinUntil" = NULL, "updatedAt" = NOW() 
            WHERE id = $1 RETURNING *
        `, [id]);

        res.json(result.rows[0]);
    } catch (err) { next(err); }
};

// 9. Upload Attachments
const uploadAttachments = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return next(new BadRequestError('No files uploaded'));
        }

        const uploadedFiles = [];
        for (const file of req.files) {
            const url = await uploadToCloudinary(file, 'note_attachments');
            uploadedFiles.push({
                name: file.originalname || 'attachment',
                url: url,
                fileType: file.mimetype || 'application/octet-stream',
                size: file.size || null
            });
        }

        res.json(uploadedFiles);
    } catch (err) { next(err); }
};

module.exports = {
    createNote,
    getNotes,
    getPinnedNotes,
    getNoteById,
    updateNote,
    deleteNote,
    pinNote,
    unpinNote,
    uploadAttachments
};
