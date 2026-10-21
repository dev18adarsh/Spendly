import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import type { Express } from 'express'
import request from 'supertest'

/**
 * The API must never pretend an operation succeeded while MongoDB is down.
 * These tests point the server at an unreachable database on purpose.
 */
let app: Express

before(async () => {
  process.env.NODE_ENV = 'test'
  // Nothing listens on port 1, so the connection attempt fails immediately.
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/spendly-unavailable'
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '500'

  const { createApp } = await import('../app.js')
  const { connectToDatabase } = await import('../config/database.js')

  app = createApp()

  await connectToDatabase().catch(() => {
    // Expected: the database is unreachable.
  })
})

describe('when MongoDB is unreachable', () => {
  it('reports the connection error on the health endpoint', async () => {
    const response = await request(app).get('/api/health')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.database.status, 'disconnected')
    assert.ok(response.body.data.database.error)
    assert.match(String(response.body.data.database.error), /connect|refus|timed out/i)
  })

  it('is not ready', async () => {
    const response = await request(app).get('/api/health/ready')

    assert.equal(response.status, 503)
    assert.equal(response.body.data.status, 'not_ready')
    assert.equal(response.body.data.database.status, 'disconnected')
  })

  it('answers transaction routes with 503 instead of an empty list', async () => {
    const response = await request(app).get('/api/transactions')

    assert.equal(response.status, 503)
    assert.equal(response.body.success, false)
    assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE')
    assert.match(response.body.error.message, /unavailable/i)
    assert.equal(response.body.data, undefined)
  })

  it('answers budget routes with 503', async () => {
    const response = await request(app).get('/api/budgets')

    assert.equal(response.status, 503)
    assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE')
  })

  it('answers writes with 503', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .send({ amount: 10, type: 'expense', category: 'food', description: 'Coffee' })

    assert.equal(response.status, 503)
    assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE')
  })

  it('still validates the request before touching the database', async () => {
    const response = await request(app).post('/api/transactions').send({ amount: -1 })

    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })
})
