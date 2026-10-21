/**
 * Application error with an HTTP status and a stable machine-readable code.
 *
 * Controllers and services throw these; the centralised error handler turns
 * them into consistent JSON responses.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  /** Errors that are the client's fault should not be logged as server faults. */
  readonly isOperational: boolean

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    // 503 is a deliberate "the dependency is down" signal, not a defect, so it
    // is reported without a stack trace.
    this.isOperational = status < 500 || status === 503
    Error.captureStackTrace?.(this, ApiError)
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static validation(message: string, details?: unknown): ApiError {
    return new ApiError(422, 'VALIDATION_ERROR', message, details)
  }

  static unauthorized(message = 'Authentication required.'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'This request was rejected.', code = 'FORBIDDEN'): ApiError {
    return new ApiError(403, code, message)
  }

  static notFound(message = 'Resource not found.'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, 'CONFLICT', message, details)
  }

  static tooManyRequests(message: string, details?: unknown): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message, details)
  }

  static databaseUnavailable(message: string, details?: unknown): ApiError {
    return new ApiError(503, 'DATABASE_UNAVAILABLE', message, details)
  }
}
