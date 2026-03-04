const pool = require('../../config/db');

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
    const noteResourcesQuery = `
      SELECT 
        'note' as "sourceType",
        n.id as "sourceId",
        n.title as "sourceName",
        e."firstName" || ' ' || e."lastName" as "authorName",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', na.id, 'name', na.name, 'url', na.url, 'fileType', na."fileType", 'size', na.size, 'heading', na.heading
          )) FROM "NoteAttachment" na WHERE na."noteId" = n.id), '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', nl.id, 'name', nl.name, 'url', nl.url, 'heading', nl.heading
          )) FROM "NoteLink" nl WHERE nl."noteId" = n.id), '[]'::json
        ) as links
      FROM "Note" n
      LEFT JOIN employee e ON n."authorId" = e.id
      WHERE n."projectId" = $1 AND n."organizationId" = $2
    `;
    const noteRes = await pool.query(noteResourcesQuery, [projectId, organiationId]);

    // 3. Fetch Comment Resources (Tasks -> Comments)
    const commentResourcesQuery = `
      SELECT 
        'comment' as "sourceType",
        t.id as "sourceId",
        t.description as "sourceName",
        e."firstName" || ' ' || e."lastName" as "authorName",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ca.id, 'name', ca.name, 'url', ca.url, 'fileType', ca."fileType", 'size', ca.size, 'heading', ca.heading
          )) FROM "CommentAttachment" ca WHERE ca."commentId" = c.id), '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', cl.id, 'name', cl.name, 'url', cl.url, 'heading', cl.heading
          )) FROM "CommentLink" cl WHERE cl."commentId" = c.id), '[]'::json
        ) as links
      FROM comment c
      JOIN task t ON c."taskId" = t.id
      LEFT JOIN employee e ON c."authorId" = e.id
      WHERE t."projectId" = $1
    `;
    const commentRes = await pool.query(commentResourcesQuery, [projectId]);

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

module.exports = {
  getProjectResources
};
