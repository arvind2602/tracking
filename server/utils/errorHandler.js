const logger = require('./logger');
const { BaseError } = require('./errors');

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(err.message, {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    error: {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      details: err.details,
      stack: err.stack,
    },
  });

  // If the error is one of our custom errors, use its properties
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.errorCode,
        details: err.details,
      },
    });
  }

  // For other types of errors, respond with a generic 500 error
  res.status(500).json({
    error: {
      message: 'An unexpected internal server error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
      details: null,
    },
  });
};

module.exports = errorHandler;
