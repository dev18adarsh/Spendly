import { ApiError } from '../utils/api-error.js'
import { toUserDto } from './mappers.js'
import { hashPassword } from './password.service.js'
import type { UserDto } from '../types/api.js'
import { UserModel, normalizeEmail } from '../models/user.model.js'

export interface CreateUserInput {
  email: string
  name: string
  /** Plaintext — hashed immediately and never persisted. */
  password: string
}

/** A user account together with the hash needed to verify a password. */
export interface UserWithSecret {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
}

/**
 * Creates an account.
 *
 * The email is normalised first so the unique index is case-insensitive in
 * practice — `Alex@Example.com` and `alex@example.com` are the same account.
 */
export async function createUser(input: CreateUserInput): Promise<UserDto> {
  const email = normalizeEmail(input.email)
  const passwordHash = await hashPassword(input.password)

  try {
    const created = await UserModel.create({
      email,
      name: input.name.trim(),
      passwordHash,
    })

    return toUserDto(created)
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'An account with that email address already exists. Try signing in instead.',
      )
    }
    throw error
  }
}

/** Looks an account up by email, including its password hash. */
export async function findUserByEmail(email: string): Promise<UserWithSecret | null> {
  const row = await UserModel.findOne({ email: normalizeEmail(email) })
    .select('+passwordHash')
    .lean()
    .exec()

  if (!row) return null

  return {
    id: String(row._id),
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  }
}

/** Looks an account up by id. */
export async function findUserById(id: string): Promise<UserWithSecret | null> {
  const row = await UserModel.findById(id)
    .select('+passwordHash')
    .lean()
    .exec()

  if (!row) return null

  return {
    id: String(row._id),
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  }
}

/** The public profile of an account — never includes the hash. */
export async function getUserProfile(id: string): Promise<UserDto | null> {
  const row = await UserModel.findById(id).lean().exec()
  return row ? toUserDto(row) : null
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  )
}
