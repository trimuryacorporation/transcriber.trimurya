import { ZodError } from 'zod';

export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || (err instanceof ZodError ? 422 : 500);
  const message = err instanceof ZodError ? err.errors.map((e) => e.message).join(', ') : err.message;
  res.status(status).json({
    message: status === 500 && process.env.NODE_ENV === 'production' ? 'Server error' : message,
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
}
