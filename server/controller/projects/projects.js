const pool = require('../../config/db');
const Joi = require('joi');
const { BadRequestError, NotFoundError } = require('../../utils/errors');


// Create Project
const createProject = async (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        description: Joi.string().allow(''),
        startDate: Joi.date().iso().required()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { name, description, startDate } = req.body;
    const organiationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `INSERT INTO projects (name, description, "startDate", "organiationId")
             VALUES ($1, $2, $3, $4) RETURNING id, name, description, "startDate"`,
            [name, description || '', startDate, organiationId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
};

// Get Single Project
const getProject = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    const projectResult = await pool.query(
      `SELECT 
         id, 
         name, 
         description, 
         "startDate", 
         "createdAt", 
         "updatedAt"
       FROM projects 
       WHERE id = $1::uuid AND "organiationId" = $2::uuid `,
      [id, organiationId]
    );

    if (projectResult.rowCount === 0) {
      return next(new NotFoundError('Project not found'));
    }

    const tasksResult = await pool.query(
      `SELECT 
         t.id,
         t.description,
         t.status,
         t.points,
         t."createdAt",
         t."updatedAt",
         COALESCE(e."firstName" || ' ' || e."lastName", 'Unassigned') AS "assignedToName"
       FROM task t
       LEFT JOIN employee e ON t."assignedTo"::uuid = e.id
       WHERE t."projectId" = $1::uuid
       ORDER BY t."createdAt" DESC`,
      [id]
    );

    res.json({
      ...projectResult.rows[0],
      tasks: tasksResult.rows,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Projects in Organization
const getProjects = async (req, res, next) => {
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `SELECT id, name, description, "startDate", "createdAt"
       FROM projects 
       WHERE "organiationId" = $1 
       AND is_archived = false 
       ORDER BY "createdAt" DESC`,
      [organiationId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Update Project
const updateProject = async (req, res, next) => {
    const { id } = req.params;
    const { name, description, startDate } = req.body;
    const organiationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `UPDATE projects SET name = $1, description = $2, "startDate" = $3, "updatedAt" = NOW()
             WHERE id = $4 AND "organiationId" = $5
             RETURNING id, name, description, "startDate"`,
            [name, description || '', startDate, id, organiationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Project not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// Delete Project (soft or hard - adjust as needed)
const deleteProject = async (req, res, next) => {
    const { id } = req.params;
    const organiationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `UPDATE projects SET is_archived = true, "updatedAt" = NOW()
             WHERE id = $1 AND "organiationId" = $2 RETURNING id`,
            [id, organiationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Project not found'));
        res.json({ message: 'Project deleted' });
    } catch (error) { next(error); }
};

module.exports = {
    createProject,
    getProject,
    getProjects,
    updateProject,
    deleteProject
};