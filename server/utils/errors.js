class BaseError extends Error {
  constructor(message, statusCode, errorCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends BaseError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class AuthenticationError extends BaseError {
  constructor(message = 'Authentication Failed', details = null) {
    super(message, 401, 'AUTHENTICATION_FAILED', details);
  }
}

class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class AuthorizationError extends BaseError {
  constructor(message = 'Authorization Failed', details = null) {
    super(message, 403, 'AUTHORIZATION_FAILED', details);
  }
}

class NotFoundError extends BaseError {
  constructor(message = 'Not Found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ConflictError extends BaseError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class UnprocessableEntityError extends BaseError {
  constructor(message = 'Unprocessable Entity', details = null) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

module.exports = {
  BaseError,
  BadRequestError,
  AuthenticationError,
  UnauthorizedError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
};
