import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import type { Express } from 'express'
import request from 'supertest'

/**
 * Without a configured connection string the server still boots, but it says
 * so plainly instead of serving empty or fabricated results.
 */
let app: Express

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.MONGODB_URI = ''

  const { createApp } = await import('../app.js')
  const { connectToDatabase } = await import('../config/database.js')

  app = createApp()

  await connectToDatabase().catch(() => {
    // Expected: no connection string is configured.
  })
})

describe('when MONGODB_URI is missing', () => {
  it('explains that no URI is configured', async () => {
    const response = await request(app).get('/api/health')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.database.status, 'disconnected')
    assert.match(String(response.body.data.database.error), /MONGODB_URI is not configured/)
  })

  it('refuses to serve transactions', async () => {
    const response = await request(app).get('/api/transactions')

    assert.equal(response.status, 503)
    assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE')
    assert.match(response.body.error.message, /MONGODB_URI is not configured/)
  })
})
