/**
 * API Error Codes and Utilities
 * Standardized error responses for consistent error handling
 */

// Error codes categorized by type
export const ERROR_CODES = {
  // Authentication errors (1xxx)
  AUTH_INVALID_CREDENTIALS: { code: 1001, message: 'Invalid email or password', status: 401 },
  AUTH_TOKEN_MISSING: { code: 1002, message: 'Authentication required. Please log in.', status: 401 },
  AUTH_TOKEN_INVALID: { code: 1003, message: 'Session expired. Please log in again.', status: 401 },
  AUTH_TOKEN_EXPIRED: { code: 1004, message: 'Session expired. Please log in again.', status: 401 },
  AUTH_USER_NOT_FOUND: { code: 1005, message: 'User not found', status: 404 },
  AUTH_EMAIL_EXISTS: { code: 1006, message: 'Email already registered', status: 400 },
  AUTH_WEAK_PASSWORD: { code: 1007, message: 'Password must be at least 6 characters', status: 400 },

  // Validation errors (2xxx)
  VALIDATION_REQUIRED_FIELD: { code: 2001, message: 'Required field missing', status: 400 },
  VALIDATION_INVALID_AMOUNT: { code: 2002, message: 'Amount must be a positive number', status: 400 },
  VALIDATION_INVALID_DATE: { code: 2003, message: 'Invalid date format', status: 400 },
  VALIDATION_INVALID_CATEGORY: { code: 2004, message: 'Invalid category', status: 400 },
  VALIDATION_INVALID_ID: { code: 2005, message: 'Invalid ID format', status: 400 },
  VALIDATION_INVALID_EMAIL: { code: 2006, message: 'Invalid email format', status: 400 },

  // Resource errors (3xxx)
  RESOURCE_NOT_FOUND: { code: 3001, message: 'Resource not found', status: 404 },
  EXPENSE_NOT_FOUND: { code: 3002, message: 'Expense not found', status: 404 },
  INCOME_NOT_FOUND: { code: 3003, message: 'Income not found', status: 404 },
  CATEGORY_NOT_FOUND: { code: 3004, message: 'Category not found', status: 404 },
  BUDGET_NOT_FOUND: { code: 3005, message: 'Budget not found', status: 404 },

  // Permission errors (4xxx)
  PERMISSION_DENIED: { code: 4001, message: 'You do not have permission to perform this action', status: 403 },
  RESOURCE_OWNERSHIP: { code: 4002, message: 'You can only modify your own resources', status: 403 },

  // Rate limiting (5xxx)
  RATE_LIMIT_EXCEEDED: { code: 5001, message: 'Too many requests. Please try again later.', status: 429 },
  AUTH_RATE_LIMIT: { code: 5002, message: 'Too many login attempts. Please try again later.', status: 429 },

  // Server errors (6xxx)
  SERVER_ERROR: { code: 6001, message: 'Something went wrong. Please try again.', status: 500 },
  DATABASE_ERROR: { code: 6002, message: 'Database operation failed', status: 500 },
  EXTERNAL_SERVICE_ERROR: { code: 6003, message: 'External service unavailable', status: 503 },

  // Business logic errors (7xxx)
  BUDGET_EXCEEDED: { code: 7001, message: 'This expense would exceed your monthly budget', status: 400 },
  SPLIT_INVALID_TOTAL: { code: 7002, message: 'Split amounts do not equal total', status: 400 },
  SPLIT_NO_PARTICIPANTS: { code: 7003, message: 'Split expense requires participants', status: 400 },
  DUPLICATE_ENTRY: { code: 7004, message: 'Duplicate entry detected', status: 409 },

  // Offline/Sync errors (8xxx)
  SYNC_CONFLICT: { code: 8001, message: 'Sync conflict detected. Please refresh.', status: 409 },
  SYNC_FAILED: { code: 8002, message: 'Sync failed. Changes saved locally.', status: 500 },
  OFFLINE_QUEUE_FULL: { code: 8003, message: 'Offline queue limit reached', status: 400 },
};

/**
 * Create a standardized error response
 */
export const createErrorResponse = (errorType, customMessage = null, details = null) => {
  const error = ERROR_CODES[errorType] || ERROR_CODES.SERVER_ERROR;
  
  return {
    success: false,
    error: {
      code: error.code,
      message: customMessage || error.message,
      type: errorType,
      ...(details && { details }),
    },
  };
};

/**
 * Create a standardized success response
 */
export const createSuccessResponse = (data, message = null) => {
  return {
    success: true,
    ...(message && { message }),
    data,
  };
};

/**
 * Express error handler middleware
 */
export const errorHandler = (err, req, res, _next) => {
  // Log error for debugging
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json(
      createErrorResponse('VALIDATION_REQUIRED_FIELD', messages.join(', '))
    );
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json(
      createErrorResponse('DUPLICATE_ENTRY', 'A record with this value already exists')
    );
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json(
      createErrorResponse('VALIDATION_INVALID_ID', 'Invalid ID format')
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      createErrorResponse('AUTH_TOKEN_INVALID')
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      createErrorResponse('AUTH_TOKEN_EXPIRED')
    );
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(
    createErrorResponse('SERVER_ERROR', err.message || 'Internal server error')
  );
};

export default {
  ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  errorHandler,
};
