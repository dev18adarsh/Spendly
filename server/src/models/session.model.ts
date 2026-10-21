import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

import { modelOptions } from './model-options.js'

/** The persisted shape of a login session. */
export interface SessionAttributes {
  /** The account this session belongs to. */
  userId: Types.ObjectId
  /**
   * SHA-256 of the opaque session token.
   *
   * The raw token only ever exists inside the HTTP-only cookie — a stolen
   * database dump yields hashes, not usable credentials.
   */
  tokenHash: string
  /** When the session stops being valid. */
  expiresAt: Date
  /** Rough client fingerprint, used for auditing only. */
  userAgent?: string
  ip?: string
  createdAt: Date
  updatedAt: Date
}

const sessionSchema = new Schema<SessionAttributes>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },
    tokenHash: {
      type: String,
      required: [true, 'tokenHash is required'],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'expiresAt is required'],
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 256,
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 64,
    },
  },
  modelOptions({ timestamps: true }),
)

sessionSchema.index({ userId: 1 })
// MongoDB removes the document once it is expired, so sessions never pile up.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type SessionDocument = HydratedDocument<SessionAttributes>

/** A session as stored in MongoDB, including its id. */
export type SessionLean = SessionAttributes & { _id: Types.ObjectId }

export const SessionModel = model<SessionAttributes>('Session', sessionSchema)
