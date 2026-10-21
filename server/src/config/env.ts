import 'dotenv/config'

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/**
 * Runtime configuration, read from the environment.
 * Every value has a safe default so the server can boot without a `.env`.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 4000),
  corsOrigins: toList(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  /** Empty when no MongoDB Atlas URI has been configured. */
  mongoUri: process.env.MONGODB_URI?.trim() ?? '',
  mongoDbName: process.env.MONGODB_DB_NAME?.trim() || 'spendly',
} as const

export const isProduction = env.nodeEnv === 'production'
