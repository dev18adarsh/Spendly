import type { Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Express } from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { Agent } from 'supertest'

export interface TestHarness {
  app: Express
  stop: () => Promise<void>
}

export interface SocketTestHarness extends TestHarness {
  httpServer: HttpServer
  port: number
  serverUrl: string
}

/**
 * Boots the API against a throwaway in-memory MongoDB.
 *
 * The environment is configured *before* the application modules are imported
 * so `config/env.ts` picks up the test URI.
 */
export async function createTestHarness(): Promise<TestHarness> {
  const mongo = await MongoMemoryServer.create()

  process.env.NODE_ENV = 'test'
  process.env.MONGODB_URI = mongo.getUri()
  process.env.MONGODB_DB_NAME = 'spendly_test'
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '5000'

  const { createApp } = await import('../app.js')
  const { connectToDatabase } = await import('../config/database.js')
  const { seedCategories } = await import('../services/category.service.js')

  await connectToDatabase()
  await seedCategories()

  return {
    app: createApp(),
    stop: async () => {
      await mongoose.disconnect()
      await mongo.stop()
    },
  }
}

/**
 * Boots the API along with the attached Socket.IO server on an ephemeral port.
 */
export async function createSocketTestHarness(): Promise<SocketTestHarness> {
  const base = await createTestHarness()
  const { createServer } = await import('node:http')
  const { initSocketServer, closeSocketServer } = await import('../socket.js')

  const httpServer = createServer(base.app)
  initSocketServer(httpServer)

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve())
  })

  const address = httpServer.address() as AddressInfo
  const port = address.port
  const serverUrl = `http://localhost:${port}`

  return {
    ...base,
    httpServer,
    port,
    serverUrl,
    stop: async () => {
      await closeSocketServer()
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve())
      })
      await base.stop()
    },
  }
}

/** Removes every document so each test starts from a known state. */
export async function resetCollections(): Promise<void> {
  const { TransactionModel } = await import('../models/transaction.model.js')
  const { BudgetModel } = await import('../models/budget.model.js')
  const { UserModel } = await import('../models/user.model.js')
  const { SessionModel } = await import('../models/session.model.js')

  await Promise.all([
    TransactionModel.deleteMany({}),
    BudgetModel.deleteMany({}),
    UserModel.deleteMany({}),
    SessionModel.deleteMany({}),
  ])

  const { resetRateLimits } = await import('../middleware/rate-limit.js')
  const { resetLoginThrottle } = await import('../services/login-throttle.service.js')
  resetRateLimits()
  resetLoginThrottle()
}

export interface TransactionInput {
  amount: number
  /** Kept as `string` so tests can submit invalid values on purpose. */
  type: string
  category: string
  description: string
  merchant?: string
  date?: string
  paymentMethod?: string
  notes?: string
}

export function transactionPayload(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    amount: 42.5,
    type: 'expense',
    category: 'food',
    description: 'Groceries',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/* Authenticated test client                                           */
/* ------------------------------------------------------------------ */

export interface Credentials {
  name?: string
  email?: string
  password?: string
}

/**
 * A supertest agent that keeps the session cookie and repeats the CSRF
 * token on every write — exactly what a browser client does.
 */
export class TestClient {
  readonly agent: Agent
  email = ''
  password = ''
  userId = ''
  csrfToken = ''
  /** The raw session token, so tests can replay a revoked cookie. */
  sessionToken = ''

  constructor(app: Express) {
    this.agent = request.agent(app)
  }

  /**
   * A client that carries a CSRF token but is not signed in.
   *
   * This is what a browser has before anybody signs in.
   */
  static async anonymous(app: Express): Promise<TestClient> {
    const client = new TestClient(app)
    client.csrfToken = await fetchCsrfToken(client)
    return client
  }

  get(path: string) {
    return this.agent.get(path)
  }

  post(path: string) {
    return this.agent.post(path).set('X-CSRF-Token', this.csrfToken)
  }

  put(path: string) {
    return this.agent.put(path).set('X-CSRF-Token', this.csrfToken)
  }

  patch(path: string) {
    return this.agent.patch(path).set('X-CSRF-Token', this.csrfToken)
  }

  delete(path: string) {
    return this.agent.delete(path).set('X-CSRF-Token', this.csrfToken)
  }
}

let accountCounter = 0

function uniqueEmail(): string {
  accountCounter += 1
  return `user-${accountCounter}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

/** Reads the CSRF cookie out of a `set-cookie` header. */
function readCookie(response: request.Response, name: string): string | undefined {
  const cookies = response.headers['set-cookie']
  const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : []

  for (const cookie of list) {
    const [pair] = cookie.split(';')
    if (!pair) continue
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    if (pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim())
    }
  }

  return undefined
}

/** Picks up the CSRF token the API hands out. */
async function fetchCsrfToken(client: TestClient): Promise<string> {
  const response = await client.agent.get('/api/auth/csrf')
  return response.body?.data?.csrfToken ?? readCookie(response, 'spendly_csrf') ?? ''
}

/**
 * Registers an account and returns a client that is signed in.
 *
 * The registration response already carries the session cookie, so the
 * returned client is ready to make authenticated requests.
 */
export async function registerUser(
  app: Express,
  credentials: Credentials = {},
): Promise<TestClient> {
  const email = credentials.email ?? uniqueEmail()
  const password = credentials.password ?? 'Str0ngPassw0rd'
  const name = credentials.name ?? 'Test User'

  const client = await TestClient.anonymous(app)
  client.email = email
  client.password = password

  const response = await client.post('/api/auth/register').send({ name, email, password })

  if (response.status !== 201) {
    throw new Error(
      `Could not register the test account: ${response.status} ${JSON.stringify(response.body)}`,
    )
  }

  client.userId = response.body.data.id
  client.sessionToken = readCookie(response, 'spendly_session') ?? ''
  return client
}
