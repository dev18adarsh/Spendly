import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { ZodError } from 'zod'

import { getConnectionError } from '../config/database.js'
import { redactUri } from '../config/env.js'
import { ApiError } from '../utils/api-error.js'
import { toFieldIssues } from '../validators/common.js'

/**
 * Detects driver-level failures that mean "the database is not reachable".
 *
 * Mongoose buffers queries when disconnected, so the eventual failure can
 * surface as a buffering timeout rather than a connection error — both mean
 * the same thing to the caller.
 */
function isDatabaseConnectivityError(error: unknown): boolean {
  if (error instanceof mongoose.Error.MongooseServerSelectionError) return true
  if (error instanceof mongoose.MongooseError) {
    return /buffering timed out|Topology was destroyed|Client must be connected/i.test(error.message)
  }
  if (error instanceof Error) {
    if (
      /MongoNetworkError|MongoServerSelectionError|MongooseServerSelectionError/i.test(error.name)
    ) {
      return true
    }
    return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Topology was destroyed/i.test(error.message)
  }
  return false
}

function isDuplicateKeyError(error: unknown): error is { keyValue?: Record<string, unknown> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  )
}

/**
 * Centralised error handler.
 *
 * Every failure leaves the API as `{ success: false, error: { ... } }`.
 * Stack traces and driver internals are never exposed to clients.
 */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    if (!error.isOperational) {
      console.error('[api] Server error:', error)
    }
    response.status(error.status).json({
      success: false,
      error: {
        status: error.status,
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    })
    return
  }

  if (error instanceof ZodError) {
    response.status(422).json({
      success: false,
      error: {
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: toFieldIssues(error),
      },
    })
    return
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.entries(error.errors).map(([field, issue]) => ({
      field,
      message: issue.message,
    }))
    response.status(422).json({
      success: false,
      error: {
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'The submitted document is not valid.',
        details,
      },
    })
    return
  }

  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({
      success: false,
      error: {
        status: 400,
        code: 'INVALID_IDENTIFIER',
        message: `"${String(error.value)}" is not a valid ${error.path}.`,
      },
    })
    return
  }

  if (isDuplicateKeyError(error)) {
    response.status(409).json({
      success: false,
      error: {
        status: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'A resource with these values already exists.',
        details: error.keyValue,
      },
    })
    return
  }

  if (isDatabaseConnectivityError(error)) {
    const rawReason = getConnectionError() ?? (error instanceof Error ? error.message : String(error))
    const reason = redactUri(rawReason)
    response.status(503).json({
      success: false,
      error: {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: `The database is unavailable, so this request could not be completed: ${reason}`,
      },
    })
    return
  }

  console.error('[api] Unhandled error:', error)
  response.status(500).json({
    success: false,
    error: {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while processing the request.',
    },
  })
}
