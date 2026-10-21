import type { Response } from 'express'

/**
 * The shape every successful response uses.
 *
 * Keeping payloads inside `data` means pagination metadata, warnings and
 * future additions can be added without breaking consumers.
 */
export interface ApiSuccessBody<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  success: false
  error: {
    status: number
    code: string
    message: string
    details?: unknown
  }
}

/** Sends a successful response with a consistent envelope. */
export function sendSuccess<T>(
  response: Response,
  data: T,
  meta?: Record<string, unknown>,
  status = 200,
): Response {
  const body: ApiSuccessBody<T> = { success: true, data }
  if (meta) body.meta = meta

  return response.status(status).json(body)
}

/** Sends a 204 with no body — used for successful deletes. */
export function sendNoContent(response: Response): Response {
  return response.status(204).send()
}
