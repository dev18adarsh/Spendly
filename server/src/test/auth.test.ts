import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import request from 'supertest'

import {
  createTestHarness,
  registerUser,
  resetCollections,
  TestClient,
  type TestHarness,
} from './harness.js'

let harness: TestHarness

before(async () => {
  harness = await createTestHarness()
})

after(async () => {
  await harness.stop()
})

beforeEach(async () => {
  await resetCollections()
})

/**
 * A client that carries a CSRF token but is not signed in.
 *
 * This is what a browser has before anybody signs in.
 */
async function anonymous(): Promise<TestClient> {
  return TestClient.anonymous(harness.app)
}

/** Reads the `Set-Cookie` headers of a response as a list of raw strings. */
function setCookies(response: request.Response): string[] {
  const cookies = response.headers['set-cookie']
  if (!cookies) return []
  return Array.isArray(cookies) ? cookies : [cookies]
}

function findCookie(response: request.Response, name: string): string | undefined {
  return setCookies(response).find((cookie) => cookie.startsWith(`${name}=`))
}

/* ------------------------------------------------------------------ */
/* Registration                                                         */
/* ------------------------------------------------------------------ */

describe('POST /api/auth/register', () => {
  it('creates an account and signs the caller in', async () => {
    const client = await anonymous()

    const response = await client
      .post('/api/auth/register')
      .send({ name: 'Alex Doe', email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.email, 'alex@example.com')
    assert.equal(response.body.data.name, 'Alex Doe')
    assert.ok(response.body.data.id)
    assert.ok(response.body.data.createdAt)

    // The password must never travel back to the client.
    assert.equal(response.body.data.passwordHash, undefined)
    assert.equal(response.body.data.password, undefined)
  })

  it('stores a bcrypt hash instead of the password', async () => {
    const client = await anonymous()

    await client
      .post('/api/auth/register')
      .send({ name: 'Alex Doe', email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    const { UserModel } = await import('../models/user.model.js')
    const stored = await UserModel.findOne({ email: 'alex@example.com' })
      .select('+passwordHash')
      .lean()
      .exec()

    assert.ok(stored)
    assert.notEqual(stored.passwordHash, 'Str0ngPassw0rd')
    assert.match(stored.passwordHash, /^\$2[aby]\$/)

    const { verifyPassword } = await import('../services/password.service.js')
    assert.equal(await verifyPassword('Str0ngPassw0rd', stored.passwordHash), true)
    assert.equal(await verifyPassword('wrong-password', stored.passwordHash), false)
  })

  it('normalises the email address', async () => {
    const client = await anonymous()

    await client
      .post('/api/auth/register')
      .send({ name: 'Alex Doe', email: '  Alex@Example.COM ', password: 'Str0ngPassw0rd' })

    const { UserModel } = await import('../models/user.model.js')
    const stored = await UserModel.findOne({ email: 'alex@example.com' }).lean().exec()

    assert.ok(stored)
    assert.equal(stored.email, 'alex@example.com')
  })

  it('rejects a duplicate email with a clear message', async () => {
    await registerUser(harness.app, { email: 'taken@example.com' })

    const client = await anonymous()
    const response = await client
      .post('/api/auth/register')
      .send({ name: 'Someone Else', email: 'taken@example.com', password: 'Str0ngPassw0rd' })

    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'EMAIL_ALREADY_REGISTERED')
    assert.match(response.body.error.message, /already exists/i)
  })

  it('rejects a malformed email', async () => {
    const client = await anonymous()
    const response = await client
      .post('/api/auth/register')
      .send({ name: 'Alex Doe', email: 'not-an-email', password: 'Str0ngPassw0rd' })

    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.ok(
      response.body.error.details.some((issue: { field: string }) => issue.field === 'email'),
    )
  })

  it('rejects a weak password', async () => {
    const client = await anonymous()
    const response = await client
      .post('/api/auth/register')
      .send({ name: 'Alex Doe', email: 'alex@example.com', password: 'short' })

    assert.equal(response.status, 422)
    assert.ok(
      response.body.error.details.some((issue: { field: string }) => issue.field === 'password'),
    )
  })

  it('rejects a password without a number', async () => {
    const client = await anonymous()
    const response = await client
      .post('/api/auth/register')
      .send({ name: 'Alex Doe', email: 'alex@example.com', password: 'onlyletters' })

    assert.equal(response.status, 422)
  })

  it('rejects a missing name', async () => {
    const client = await anonymous()
    const response = await client
      .post('/api/auth/register')
      .send({ email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    assert.equal(response.status, 422)
  })

  it('rejects a mismatched confirmation', async () => {
    const client = await anonymous()
    const response = await client
      .post('/api/auth/register')
      .send({
        name: 'Alex Doe',
        email: 'alex@example.com',
        password: 'Str0ngPassw0rd',
        confirmPassword: 'Different1',
      })

    assert.equal(response.status, 422)
    assert.ok(
      response.body.error.details.some(
        (issue: { field: string }) => issue.field === 'confirmPassword',
      ),
    )
  })
})

/* ------------------------------------------------------------------ */
/* Sign in                                                              */
/* ------------------------------------------------------------------ */

describe('POST /api/auth/login', () => {
  it('signs a user in and returns their profile', async () => {
    await registerUser(harness.app, { email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    const client = await anonymous()
    const response = await client
      .post('/api/auth/login')
      .send({ email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.email, 'alex@example.com')
    assert.equal(response.body.data.passwordHash, undefined)
  })

  it('sets an HTTP-only session cookie', async () => {
    await registerUser(harness.app, { email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    const agent = request.agent(harness.app)
    const bootstrap = await agent.get('/api/auth/csrf')

    const response = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
      .send({ email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    const sessionCookie = findCookie(response, 'spendly_session')
    assert.ok(sessionCookie, 'a session cookie is set')
    assert.match(sessionCookie, /HttpOnly/i)
    assert.match(sessionCookie, /SameSite/i)
    assert.match(sessionCookie, /Path=\//i)

    // The CSRF cookie is deliberately readable by scripts.
    const csrfCookie = findCookie(bootstrap, 'spendly_csrf')
    assert.ok(csrfCookie)
    assert.doesNotMatch(csrfCookie, /HttpOnly/i)
  })

  it('rejects a wrong password without saying which part was wrong', async () => {
    await registerUser(harness.app, { email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    const client = await anonymous()
    const response = await client
      .post('/api/auth/login')
      .send({ email: 'alex@example.com', password: 'WrongPassw0rd' })

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS')
    assert.match(response.body.error.message, /do not match/i)
  })

  it('gives an unknown email the same answer as a wrong password', async () => {
    const client = await anonymous()
    const unknown = await client
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassw0rd' })

    assert.equal(unknown.status, 401)
    assert.equal(unknown.body.error.code, 'INVALID_CREDENTIALS')
    assert.match(unknown.body.error.message, /do not match/i)
  })

  it('locks an account after too many failed attempts', async () => {
    await registerUser(harness.app, { email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    const client = await anonymous()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await client
        .post('/api/auth/login')
        .send({ email: 'alex@example.com', password: 'WrongPassw0rd' })

      assert.equal(response.status, 401)
    }

    const blocked = await client
      .post('/api/auth/login')
      .send({ email: 'alex@example.com', password: 'Str0ngPassw0rd' })

    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.error.code, 'LOGIN_RATE_LIMITED')
  })

  it('rejects a missing password', async () => {
    const client = await anonymous()
    const response = await client.post('/api/auth/login').send({ email: 'alex@example.com' })

    assert.equal(response.status, 422)
  })
})

/* ------------------------------------------------------------------ */
/* Sign out and current user                                            */
/* ------------------------------------------------------------------ */

describe('POST /api/auth/logout', () => {
  it('revokes the session and clears the cookies', async () => {
    const client = await registerUser(harness.app)

    const before = await client.get('/api/auth/me')
    assert.equal(before.status, 200)

    const response = await client.post('/api/auth/logout')
    assert.equal(response.status, 204)

    const cleared = findCookie(response, 'spendly_session')
    assert.ok(cleared)
    assert.match(cleared, /Max-Age=0|Expires=Thu, 01 Jan 1970/i)

    // The browser no longer holds a session, so the caller is simply
    // anonymous from now on.
    const after = await client.get('/api/auth/me')
    assert.equal(after.status, 401)
    assert.equal(after.body.error.code, 'UNAUTHORIZED')
  })

  it('revokes the session on the server', async () => {
    const client = await registerUser(harness.app)
    assert.ok(client.sessionToken)

    await client.post('/api/auth/logout')

    // Even when the cookie is replayed, the session is gone.
    const replay = await request(harness.app)
      .get('/api/auth/me')
      .set('Cookie', `spendly_session=${client.sessionToken}`)

    assert.equal(replay.status, 401)
    assert.equal(replay.body.error.code, 'SESSION_EXPIRED')
  })

  it('succeeds even without a session', async () => {
    const client = await anonymous()

    const response = await client.post('/api/auth/logout')

    assert.equal(response.status, 204)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the signed-in account', async () => {
    const client = await registerUser(harness.app, { name: 'Alex Doe' })

    const response = await client.get('/api/auth/me')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.name, 'Alex Doe')
    assert.equal(response.body.data.email, client.email)
  })

  it('rejects an anonymous request', async () => {
    const response = await request(harness.app).get('/api/auth/me')

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'UNAUTHORIZED')
  })

  it('rejects a forged session cookie', async () => {
    const response = await request(harness.app)
      .get('/api/auth/me')
      .set('Cookie', 'spendly_session=made-up-token')

    assert.equal(response.status, 401)
  })
})

/* ------------------------------------------------------------------ */
/* Protected routes                                                     */
/* ------------------------------------------------------------------ */

describe('protected routes', () => {
  const routes: [string, string, unknown?][] = [
    ['get', '/api/transactions'],
    ['post', '/api/transactions', { amount: 10, type: 'expense', category: 'food', description: 'Coffee' }],
    ['get', '/api/budgets'],
    ['post', '/api/budgets', { category: 'food', limit: 300, month: 3, year: 2026 }],
    ['get', '/api/analytics/summary'],
    ['get', '/api/analytics/cashflow'],
    ['get', '/api/analytics/categories'],
    ['get', '/api/analytics/merchants'],
  ]

  for (const [method, path, body] of routes) {
    it(`rejects an anonymous ${method.toUpperCase()} ${path}`, async () => {
      const call = request(harness.app)[method as 'get' | 'post'](path)

      const response = body === undefined ? await call : await call.send(body as object)

      assert.equal(response.status, 401)
      assert.equal(response.body.success, false)
      assert.equal(response.body.error.code, 'UNAUTHORIZED')
    })
  }

  it('lets the public routes through without a session', async () => {
    const health = await request(harness.app).get('/api/health')
    assert.equal(health.status, 200)

    const categories = await request(harness.app).get('/api/categories')
    assert.equal(categories.status, 200)
  })
})

/* ------------------------------------------------------------------ */
/* CSRF protection                                                      */
/* ------------------------------------------------------------------ */

describe('CSRF protection', () => {
  it('rejects a write without a CSRF token', async () => {
    const client = await registerUser(harness.app)

    const response = await client.agent.post('/api/transactions').send({
      amount: 10,
      type: 'expense',
      category: 'food',
      description: 'Coffee',
    })

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'CSRF_TOKEN_MISSING')
  })

  it('rejects a write with the wrong CSRF token', async () => {
    const client = await registerUser(harness.app)

    const response = await client.agent
      .post('/api/transactions')
      .set('X-CSRF-Token', 'not-the-right-token')
      .send({ amount: 10, type: 'expense', category: 'food', description: 'Coffee' })

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'CSRF_TOKEN_INVALID')
  })

  it('rejects a write from an origin that is not allowed', async () => {
    const client = await registerUser(harness.app)

    const response = await client.agent
      .post('/api/transactions')
      .set('X-CSRF-Token', client.csrfToken)
      .set('Origin', 'https://evil.example.com')
      .send({ amount: 10, type: 'expense', category: 'food', description: 'Coffee' })

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'ORIGIN_NOT_ALLOWED')
  })

  it('accepts a write from an allowed origin', async () => {
    const client = await registerUser(harness.app)

    const response = await client.agent
      .post('/api/transactions')
      .set('X-CSRF-Token', client.csrfToken)
      .set('Origin', 'http://localhost:5173')
      .send({ amount: 10, type: 'expense', category: 'food', description: 'Coffee' })

    assert.equal(response.status, 201)
  })

  it('does not require a token for reading', async () => {
    const client = await registerUser(harness.app)

    const response = await client.agent.get('/api/transactions')
    assert.equal(response.status, 200)
  })
})
