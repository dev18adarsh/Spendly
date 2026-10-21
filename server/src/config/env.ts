import 'dotenv/config'

export type NodeEnv = 'development' | 'test' | 'production'

function readString(value: string | undefined): string {
  return value?.trim() ?? ''
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(readString(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readList(value: string | undefined, fallback: string[]): string[] {
  const raw = readString(value)
  if (!raw) return fallback

  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return parsed.length > 0 ? parsed : fallback
}

function readNodeEnv(value: string | undefined): NodeEnv {
  return value === 'production' || value === 'test' ? value : 'development'
}

const nodeEnv = readNodeEnv(process.env.NODE_ENV)
const mongoUri = readString(process.env.MONGODB_URI)

/**
 * Runtime configuration, read exclusively from the environment.
 *
 * Secrets (the MongoDB Atlas URI in particular) are never returned to a
 * client and never logged — `redactUri` is used wherever a connection string
 * needs to be mentioned in output.
 */
export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: readNumber(process.env.PORT, 4000),
  /** Origins allowed to call the API from a browser. */
  corsOrigins: readList(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  /** Empty when no MongoDB Atlas URI has been configured. */
  mongoUri,
  mongoDbName: readString(process.env.MONGODB_DB_NAME) || 'spendly',
  /** How long to wait for a MongoDB server selection before failing. */
  mongoServerSelectionTimeoutMs: readNumber(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10_000),
  /** Maximum number of documents a single page may return. */
  maxPageSize: readNumber(process.env.MAX_PAGE_SIZE, 100),
} as const

/**
 * Strips the credentials out of a MongoDB connection string so it can safely
 * appear in logs and API responses.
 */
export function redactUri(uri: string): string {
  if (!uri) return ''

  return uri.replace(/\/\/([^@/]+)@/, (_match, credentials: string) => {
    const user = credentials.split(':')[0] ?? ''
    return `//${user ? `${user}:***` : '***'}@`
  })
}

/**
 * Validates the configuration that cannot be defaulted.
 *
 * In production a missing MongoDB URI is fatal — the process refuses to start
 * rather than silently serving a broken API.
 */
export function assertEnvIsValid(): void {
  if (!env.isProduction) return

  const missing: string[] = []
  if (!env.mongoUri) missing.push('MONGODB_URI')

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and configure them before starting in production.',
    )
  }
}
