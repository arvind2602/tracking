const winston = require('winston');

// Vercel's filesystem is read-only (writes only go to /tmp), so file transports
// are only used outside production.
const transports = [new winston.transports.Console()];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  );
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports,
});

module.exports = logger;
