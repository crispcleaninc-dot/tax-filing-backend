import { generateCorrelationId } from '../utils/encryption.js';

/**
 * Middleware to add correlation ID to requests for tracking
 */
export const correlationMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  // Attach to request logger
  req.log = {
    correlationId,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  };

  next();
};
