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

/** How the session cookie is scoped across sites. */
export type CookieSameSite = 'lax' | 'strict' | 'none'

function readSameSite(value: string | undefined, fallback: CookieSameSite): CookieSameSite {
  const raw = readString(value).toLowerCase()
  return raw === 'lax' || raw === 'strict' || raw === 'none' ? raw : fallback
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  const raw = readString(value).toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  return fallback
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

  /* --------------------------------------------------------------- */
  /* Authentication                                                    */
  /* --------------------------------------------------------------- */
  /** How long a session stays valid before it has to be renewed. */
  sessionTtlMs: readNumber(process.env.SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000),
  /**
   * `SameSite` policy for the session and CSRF cookies.
   *
   * `lax` (the default) and `strict` are enough whenever the API and the
   * frontend share a site — `localhost:5173` and `localhost:4000` do.
   * Deploy the API on a *different* site (a separate domain) and this must
   * become `none`, which in turn requires `COOKIE_SECURE=true` because
   * browsers only accept `SameSite=None` over HTTPS.
   */
  cookieSameSite: readSameSite(process.env.COOKIE_SAMESITE, 'lax'),
  /** Whether the cookies are marked `Secure`. Defaults to on in production. */
  cookieSecure: readBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production'),
  /** Optional cookie domain, e.g. `.spendly.com` to share cookies with subdomains. */
  cookieDomain: readString(process.env.COOKIE_DOMAIN),
  /**
   * bcrypt cost factor. Lower in tests so the suite stays fast, higher in
   * production so hashes are expensive to attack.
   */
  bcryptRounds: readNumber(process.env.BCRYPT_ROUNDS, nodeEnv === 'test' ? 4 : 12),
  /** Failed logins allowed per account before it is temporarily locked. */
  loginAttemptLimit: readNumber(process.env.LOGIN_ATTEMPT_LIMIT, 5),
  /** How long an account stays locked after too many failed logins (ms). */
  loginAttemptWindowMs: readNumber(process.env.LOGIN_ATTEMPT_WINDOW_MS, 15 * 60 * 1000),
  /** Login requests allowed per IP within the rate-limit window. */
  loginRateLimit: readNumber(process.env.LOGIN_RATE_LIMIT, 20),
  /** Registration requests allowed per IP within the rate-limit window. */
  registerRateLimit: readNumber(process.env.REGISTER_RATE_LIMIT, 5),
  /** Length of the rate-limit window in milliseconds. */
  rateLimitWindowMs: readNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
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
