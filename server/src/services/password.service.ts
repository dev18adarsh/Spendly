import bcrypt from 'bcryptjs'

import { env } from '../config/env.js'

/**
 * Password hashing.
 *
 * bcrypt is deliberately slow, which is exactly the point: it makes offline
 * cracking of a stolen hash expensive. The cost factor comes from the
 * environment so it can be raised without touching the code.
 */

/** The maximum password length bcrypt accepts (it truncates beyond 72 bytes). */
export const MAX_PASSWORD_LENGTH = 72

/** Hashes a plaintext password. The plaintext is never stored or logged. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.bcryptRounds)
}

/**
 * Checks a plaintext password against a stored hash.
 *
 * Returns `false` for malformed hashes instead of throwing, so a corrupted
 * record can never be used to bypass the check.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

/**
 * A valid bcrypt hash of a random value.
 *
 * Comparing against it when no account was found keeps the time spent on a
 * login roughly constant, so the response time does not reveal whether the
 * email exists.
 */
let decoyHash: string | null = null

export async function dummyPasswordHash(): Promise<string> {
  if (!decoyHash) {
    decoyHash = await bcrypt.hash(`decoy-${Math.random().toString(36).slice(2)}`, env.bcryptRounds)
  }
  return decoyHash
}
