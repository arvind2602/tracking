const pool = require('../../config/db');
const { AuthorizationError, BadRequestError, NotFoundError } = require('../../utils/errors');

const getProjectResources = async (req, res, next) => {
  const { projectId } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    // 1. Verify Project belongs to org
    const projectCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND "organiationId" = $2',
      [projectId, organiationId]
    );
    if (projectCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. Fetch Note Resources
    // We get Notes connected to this project
    // Filter: ORGANIZATIONAL notes visible to all, 
    // PERSONAL/PROJECT notes only visible to author, tagged users, or admins
    const noteResourcesQuery = `
      SELECT 
        'note' as "sourceType",
        n.id as "sourceId",
        n.title as "sourceName",
        n."authorId" as "authorId",
        e."firstName" || ' ' || e."lastName" as "authorName",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', na.id, 'name', na.name, 'url', na.url, 'fileType', na."fileType", 'size', na.size, 'heading', na.heading
          )) FROM note_attachment na WHERE na."noteId" = n.id), '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', nl.id, 'name', nl.name, 'url', nl.url, 'heading', nl.heading
          )) FROM note_link nl WHERE nl."noteId" = n.id), '[]'::json
        ) as links
      FROM note n
      LEFT JOIN employee e ON n."authorId" = e.id
      WHERE n."projectId" = $1 
        AND n."organizationId" = $2
        AND (
          n.type = 'ORGANIZATIONAL'
          OR $3 = 'ADMIN'
          OR n."authorId" = $4
          OR EXISTS (SELECT 1 FROM note_tag nt WHERE nt."noteId" = n.id AND nt."employeeId" = $4)
        )
    `;
    // 3. Comment Resources query (Tasks -> Comments)
    const commentResourcesQuery = `
      SELECT 
        'comment' as "sourceType",
        t.id as "sourceId",
        t.description as "sourceName",
        c."authorId" as "authorId",
        e."firstName" || ' ' || e."lastName" as "authorName",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ca.id, 'name', ca.name, 'url', ca.url, 'fileType', ca."fileType", 'size', ca.size, 'heading', ca.heading
          )) FROM comment_attachment ca WHERE ca."commentId" = c.id), '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', cl.id, 'name', cl.name, 'url', cl.url, 'heading', cl.heading
          )) FROM comment_link cl WHERE cl."commentId" = c.id), '[]'::json
        ) as links
      FROM comment c
      JOIN task t ON c."taskId" = t.id
      LEFT JOIN employee e ON c."authorId" = e.id
      WHERE t."projectId" = $1
    `;
    // Notes and comments are independent — fetch together (was sequential).
    const [noteRes, commentRes] = await Promise.all([
      pool.query(noteResourcesQuery, [projectId, organiationId, req.user.role, req.user.user_uuid]),
      pool.query(commentResourcesQuery, [projectId]),
    ]);

    // 4. Combine and Filter
    // We only want to return items that actually have attachments or links
    let allResources = [];

    const formatResources = (rows) => {
      rows.forEach(row => {
        if (row.attachments.length > 0 || row.links.length > 0) {
          allResources.push({
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            authorId: row.authorId,
            authorName: row.authorName,
            attachments: row.attachments,
            links: row.links
          });
        }
      });
    };

    formatResources(noteRes.rows);
    formatResources(commentRes.rows);

    res.json(allResources);
  } catch (error) {
    next(error);
  }
};

// Deletes a single attachment/link from the Resources tab. Rows live in four
// tables (note/comment × attachment/link), so we first locate the row within
// this project's notes or comments, check authorship, then delete it.
const FIND_ITEM_SQL = {
  attachment: `
    SELECT 'note'::text AS source, n."authorId" AS "authorId"
    FROM note_attachment na
    JOIN note n ON na."noteId" = n.id
    JOIN projects p ON n."projectId" = p.id
    WHERE na.id = $1 AND n."projectId" = $2 AND p."organiationId" = $3
    UNION ALL
    SELECT 'comment'::text AS source, c."authorId" AS "authorId"
    FROM comment_attachment ca
    JOIN comment c ON ca."commentId" = c.id
    JOIN task t ON c."taskId" = t.id
    JOIN projects p ON t."projectId" = p.id
    WHERE ca.id = $1 AND t."projectId" = $2 AND p."organiationId" = $3`,
  link: `
    SELECT 'note'::text AS source, n."authorId" AS "authorId"
    FROM note_link nl
    JOIN note n ON nl."noteId" = n.id
    JOIN projects p ON n."projectId" = p.id
    WHERE nl.id = $1 AND n."projectId" = $2 AND p."organiationId" = $3
    UNION ALL
    SELECT 'comment'::text AS source, c."authorId" AS "authorId"
    FROM comment_link cl
    JOIN comment c ON cl."commentId" = c.id
    JOIN task t ON c."taskId" = t.id
    JOIN projects p ON t."projectId" = p.id
    WHERE cl.id = $1 AND t."projectId" = $2 AND p."organiationId" = $3`,
};

const DELETE_TABLE_BY_SOURCE = {
  attachment: { note: 'note_attachment', comment: 'comment_attachment' },
  link: { note: 'note_link', comment: 'comment_link' },
};

const deleteResourceItem = (kind) => async (req, res, next) => {
  const { projectId } = req.params;
  const id = kind === 'attachment' ? req.params.attachmentId : req.params.linkId;
  const organiationId = req.user.organization_uuid;

  if (!id) return next(new BadRequestError('Resource id is required'));

  try {
    const found = await pool.query(FIND_ITEM_SQL[kind], [id, projectId, organiationId]);
    const target = found.rows[0];
    if (!target) return next(new NotFoundError('Resource not found'));

    if (req.user.role !== 'ADMIN' && target.authorId !== req.user.user_uuid) {
      return next(new AuthorizationError('Only the author or an admin can delete this resource'));
    }

    const table = DELETE_TABLE_BY_SOURCE[kind][target.source];
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

    res.json({ success: true, id });
  } catch (error) { next(error); }
};

const deleteResourceAttachment = deleteResourceItem('attachment');
const deleteResourceLink = deleteResourceItem('link');

module.exports = {
  getProjectResources,
  deleteResourceAttachment,
  deleteResourceLink
};
