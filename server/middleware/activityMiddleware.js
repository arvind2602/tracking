const Joi = require("joi");
const { BadRequestError } = require("../utils/errors");

/**
 * Middleware that logs request activity and validates date parameters.
 * Runs on mutating routes to track user activity timestamps.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const activityMiddleware = async (req, res, next) => {
  try {
    const keys = ["updated_at", "created_at", "read_at"];
    let date;
    for (const key of keys) {
      date = req.query?.[key] || req.body?.[key];
      if (date) break;
    }

    // Validate date if provided (optional — allows requests without activity dates)
    if (date) {
      const { error } = Joi.date().iso().validate(date);
      if (error) {
        return next(new BadRequestError("Invalid activity date format. Expected ISO 8601."));
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = activityMiddleware;
