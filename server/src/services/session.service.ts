import { createHash, randomBytes } from 'node:crypto'

import { env } from '../config/env.js'
import { SessionModel } from '../models/session.model.js'
import { findUserById, type UserWithSecret } from './user.service.js'

/** A freshly created session and the token that authenticates it. */
export interface CreatedSession {
  /** The raw token — it is handed to the client inside an HTTP-only cookie. */
  token: string
  expiresAt: Date
}

export interface SessionMeta {
  userAgent?: string | undefined
  ip?: string | undefined
}

/** Hashes a token so the database never holds a usable credential. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Creates a session for a user.
 *
 * The returned token is 256 bits of randomness — guessing it is not an
 * option. Only its hash is persisted.
 */
export async function createSession(userId: string, meta: SessionMeta = {}): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + env.sessionTtlMs)

  await SessionModel.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  })

  return { token, expiresAt }
}

/** A session that has been verified against the database. */
export interface ResolvedSession {
  sessionId: string
  expiresAt: Date
  user: UserWithSecret
}

/**
 * Resolves a session token to the account it belongs to.
 *
 * Returns `null` for unknown, expired or revoked tokens — the caller cannot
 * tell the difference, which is exactly the point.
 */
export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  if (!token) return null

  const row = await SessionModel.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).lean().exec()

  if (!row) return null

  const user = await findUserById(String(row.userId))
  if (!user) {
    // The account was deleted while the session was still around.
    await SessionModel.deleteOne({ _id: row._id }).exec()
    return null
  }

  return {
    sessionId: String(row._id),
    expiresAt: row.expiresAt,
    user,
  }
}

/** Revokes a single session. */
export async function destroySession(token: string): Promise<void> {
  if (!token) return
  await SessionModel.deleteOne({ tokenHash: hashToken(token) }).exec()
}

/** Revokes every session belonging to an account. */
export async function destroyUserSessions(userId: string): Promise<void> {
  await SessionModel.deleteMany({ userId }).exec()
}
