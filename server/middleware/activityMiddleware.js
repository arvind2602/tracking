const Joi = require("joi");
const { pool } = require("../config/db");
const { BadRequestError } = require("../utils/errors");

const activityMiddleware = async (req, res, next) => {
  try {
    //Client sends any of the key through req.query or req.body
    const keys = ["updated_at", "created_at", "read_at"];
    let date = undefined;
    for (let key of keys) {
      date = req.query?.[key] || req.body?.[key];
      if(date) break;
    }
    // const { error } = Joi.date().iso().required().validate(date);
    // if (error)
    //   throw new BadRequestError(
    //     "Failed to update activity of user. Invalid or missing date"
    //   );

    console.log(req.method, req.url, "triggered activity middleware");
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = activityMiddleware;
