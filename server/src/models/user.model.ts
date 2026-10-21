import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

import { modelOptions } from './model-options.js'

/** The persisted shape of a user account. */
export interface UserAttributes {
  /** Stored normalised — trimmed and lower-cased — so it is unique. */
  email: string
  name: string
  /** bcrypt hash. Never selected by default and never serialised. */
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Normalises an email address.
 *
 * Applied both by the schema and by the service layer so a lookup always
 * matches the stored value, whatever casing the client sent.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const userSchema = new Schema<UserAttributes>(
  {
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, 'email cannot exceed 254 characters'],
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      maxlength: [80, 'name cannot exceed 80 characters'],
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      // Hidden unless a query explicitly asks for it.
      select: false,
    },
  },
  {
    ...modelOptions({ timestamps: true }),
    toJSON: {
      transform: (_document, returned: Record<string, unknown>) => {
        returned.id = String(returned._id)
        delete returned._id
        delete returned.__v
        // The hash must never leave the server, not even by accident.
        delete returned.passwordHash
        return returned
      },
    },
  },
)

export type UserDocument = HydratedDocument<UserAttributes>

/** A user as stored in MongoDB, including its id. */
export type UserLean = UserAttributes & { _id: Types.ObjectId }

export const UserModel = model<UserAttributes>('User', userSchema)
