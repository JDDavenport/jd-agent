import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

// Custom error types
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(500, message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

// Error response structure
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// Global error handler middleware
export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    console.error('Error caught in middleware:', error);

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined = undefined;

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorCode = error.code || 'APP_ERROR';
      message = error.message;
    } else if (error instanceof HTTPException) {
      statusCode = error.status;
      errorCode = 'HTTP_ERROR';
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
      // In development, include stack trace
      if (process.env.NODE_ENV === 'development') {
        details = { stack: error.stack };
      }
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, statusCode as any);
  }
}

// Request logging middleware
export async function requestLogger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(`${method} ${path} ${status} - ${duration}ms`);
}
