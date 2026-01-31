const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwtConfig');
const { UnauthorizedError } = require('../utils/errors');

const authMiddleware = (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return next(new UnauthorizedError('No token, authorization denied'));
        }

        const decoded = jwt.verify(token, jwtConfig.secret);
   
        req.user = {
            user_uuid: decoded.user.uuid,
            role: decoded.user.role,
            organization_uuid: decoded.user.organization_uuid,
            is_hr: decoded.user.is_hr || false,
        };


        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Token expired'));
        }
        if (error.name === 'JsonWebTokenError') {
            return next(new UnauthorizedError('Token is not valid'));
        }
        next(error);
    }
};

module.exports = authMiddleware;
