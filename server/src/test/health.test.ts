import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import request from 'supertest'

import { createTestHarness, type TestHarness } from './harness.js'

let harness: TestHarness

before(async () => {
  harness = await createTestHarness()
})

after(async () => {
  await harness.stop()
})

describe('GET /api/health', () => {
  it('reports the service and database status', async () => {
    const response = await request(harness.app).get('/api/health')

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.status, 'ok')
    assert.equal(response.body.data.service, 'spendly-api')
    assert.equal(response.body.data.database.status, 'connected')
    assert.equal(response.body.data.database.error, null)
    assert.ok(response.body.data.timestamp)
  })
})

describe('GET /api/health/ready', () => {
  it('is ready while the database is connected', async () => {
    const response = await request(harness.app).get('/api/health/ready')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, 'ready')
    assert.equal(response.body.data.database.status, 'connected')
  })
})

describe('GET /api/categories', () => {
  it('returns the seeded taxonomy', async () => {
    const response = await request(harness.app).get('/api/categories')

    assert.equal(response.status, 200)
    assert.ok(response.body.data.length > 0)

    const food = response.body.data.find((item: { slug: string }) => item.slug === 'food')
    assert.ok(food)
    assert.equal(food.name, 'Food & Dining')
    assert.equal(food.color, '#f2b544')
    assert.equal(food.icon, 'UtensilsCrossed')
  })
})

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const response = await request(harness.app).get('/api/does-not-exist')

    assert.equal(response.status, 404)
    assert.equal(response.body.success, false)
    assert.equal(response.body.error.code, 'NOT_FOUND')
  })
})

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const response = await request(harness.app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')

    assert.equal(response.status, 200)
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173')
  })

  it('does not allow an unknown origin', async () => {
    const response = await request(harness.app)
      .get('/api/health')
      .set('Origin', 'https://evil.example.com')

    assert.equal(response.headers['access-control-allow-origin'], undefined)
  })
})
