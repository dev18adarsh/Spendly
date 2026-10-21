import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import request from 'supertest'

import { createTestHarness, resetCollections, transactionPayload, type TestHarness } from './harness.js'

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

describe('POST /api/transactions', () => {
  it('creates a transaction and returns it in the success envelope', async () => {
    const response = await request(harness.app)
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 18.99,
          merchant: 'Blue Bottle Coffee',
          paymentMethod: 'card',
        }),
      )

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)

    const created = response.body.data
    assert.equal(created.amount, 18.99)
    assert.equal(created.type, 'expense')
    assert.equal(created.category, 'food')
    assert.equal(created.categoryName, 'Food & Dining')
    assert.equal(created.description, 'Groceries')
    assert.equal(created.merchant, 'Blue Bottle Coffee')
    assert.equal(created.paymentMethod, 'card')
    assert.equal(created.status, 'cleared')
    assert.ok(created.id)
    assert.ok(Date.parse(created.date))
    assert.ok(created.createdAt)
    assert.ok(created.updatedAt)
  })

  it('stores the document in MongoDB', async () => {
    const response = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload())

    const { TransactionModel } = await import('../models/transaction.model.js')
    const stored = await TransactionModel.findById(response.body.data.id).lean().exec()

    assert.ok(stored)
    assert.equal(stored.amount, 42.5)
    assert.equal(stored.category, 'food')
  })

  it('rejects a body without an amount', async () => {
    const response = await request(harness.app).post('/api/transactions').send({
      type: 'expense',
      category: 'food',
      description: 'Missing amount',
    })

    assert.equal(response.status, 422)
    assert.equal(response.body.success, false)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.ok(response.body.error.details.some((issue: { field: string }) => issue.field === 'amount'))
  })

  it('rejects a negative amount', async () => {
    const response = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload({ amount: -5 }))

    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  it('rejects an unknown category', async () => {
    const response = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload({ category: 'cryptocurrency' }))

    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  it('rejects an unknown type', async () => {
    const response = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload({ type: 'transfer' }))

    assert.equal(response.status, 422)
  })

  it('rejects unknown fields', async () => {
    const response = await request(harness.app)
      .post('/api/transactions')
      .send({ ...transactionPayload(), sneaky: true })

    assert.equal(response.status, 422)
  })
})

describe('GET /api/transactions', () => {
  beforeEach(async () => {
    await request(harness.app)
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 10,
          type: 'expense',
          category: 'food',
          description: 'Coffee',
          date: '2026-03-10T12:00:00.000Z',
        }),
      )
    await request(harness.app)
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 2000,
          type: 'income',
          category: 'income',
          description: 'Salary',
          date: '2026-03-12T12:00:00.000Z',
        }),
      )
    await request(harness.app)
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 75,
          type: 'expense',
          category: 'transport',
          description: 'Train ticket',
          date: '2026-04-02T12:00:00.000Z',
        }),
      )
  })

  it('returns every transaction with pagination metadata', async () => {
    const response = await request(harness.app).get('/api/transactions')

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.length, 3)
    assert.equal(response.body.meta.pagination.total, 3)
    assert.equal(response.body.meta.pagination.page, 1)
    assert.equal(response.body.meta.pagination.limit, 20)
    assert.equal(response.body.meta.pagination.totalPages, 1)
  })

  it('filters by type', async () => {
    const response = await request(harness.app).get('/api/transactions?type=income')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].type, 'income')
    assert.equal(response.body.meta.pagination.total, 1)
  })

  it('filters by category', async () => {
    const response = await request(harness.app).get('/api/transactions?category=transport')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].category, 'transport')
  })

  it('filters by date range', async () => {
    const response = await request(harness.app).get(
      '/api/transactions?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z',
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].description, 'Train ticket')
  })

  it('filters by search text', async () => {
    const response = await request(harness.app).get('/api/transactions?search=coffee')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].description, 'Coffee')
  })

  it('paginates results', async () => {
    const first = await request(harness.app).get('/api/transactions?limit=2&page=1')
    const second = await request(harness.app).get('/api/transactions?limit=2&page=2')

    assert.equal(first.body.data.length, 2)
    assert.equal(first.body.meta.pagination.hasNextPage, true)
    assert.equal(first.body.meta.pagination.hasPreviousPage, false)

    assert.equal(second.body.data.length, 1)
    assert.equal(second.body.meta.pagination.hasNextPage, false)
    assert.equal(second.body.meta.pagination.hasPreviousPage, true)
    assert.equal(second.body.meta.pagination.total, 3)
  })

  it('sorts by the requested field', async () => {
    const response = await request(harness.app).get('/api/transactions?sort=amount&limit=10')

    assert.equal(response.status, 200)
    const amounts = response.body.data.map((item: { amount: number }) => item.amount)
    assert.deepEqual(amounts, [10, 75, 2000])
  })

  it('rejects an invalid filter value', async () => {
    const response = await request(harness.app).get('/api/transactions?type=bogus')

    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  it('rejects a date range that ends before it starts', async () => {
    const response = await request(harness.app).get(
      '/api/transactions?from=2026-05-01T00:00:00.000Z&to=2026-04-01T00:00:00.000Z',
    )

    assert.equal(response.status, 422)
  })
})

describe('GET /api/transactions/:id', () => {
  it('returns a single transaction', async () => {
    const created = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload())

    const response = await request(harness.app).get(`/api/transactions/${created.body.data.id}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.data.id, created.body.data.id)
  })

  it('returns 404 for an unknown id', async () => {
    const response = await request(harness.app).get('/api/transactions/64b7f1c2a1b2c3d4e5f6a7b8')

    assert.equal(response.status, 404)
    assert.equal(response.body.success, false)
    assert.equal(response.body.error.code, 'NOT_FOUND')
  })
})

describe('PATCH /api/transactions/:id', () => {
  it('updates the given fields only', async () => {
    const created = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload({ amount: 30, merchant: 'Corner Store' }))

    const response = await request(harness.app)
      .patch(`/api/transactions/${created.body.data.id}`)
      .send({ amount: 55.25, description: 'Updated description' })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.amount, 55.25)
    assert.equal(response.body.data.description, 'Updated description')
    assert.equal(response.body.data.merchant, 'Corner Store')
    assert.equal(response.body.data.category, 'food')
  })

  it('rejects an empty body', async () => {
    const created = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload())

    const response = await request(harness.app).patch(`/api/transactions/${created.body.data.id}`).send({})

    assert.equal(response.status, 422)
  })

  it('returns 404 for an unknown id', async () => {
    const response = await request(harness.app)
      .patch('/api/transactions/64b7f1c2a1b2c3d4e5f6a7b8')
      .send({ amount: 10 })

    assert.equal(response.status, 404)
  })
})

describe('DELETE /api/transactions/:id', () => {
  it('removes the transaction', async () => {
    const created = await request(harness.app)
      .post('/api/transactions')
      .send(transactionPayload())

    const deleted = await request(harness.app).delete(`/api/transactions/${created.body.data.id}`)
    assert.equal(deleted.status, 204)

    const fetched = await request(harness.app).get(`/api/transactions/${created.body.data.id}`)
    assert.equal(fetched.status, 404)

    const list = await request(harness.app).get('/api/transactions')
    assert.equal(list.body.meta.pagination.total, 0)
  })

  it('returns 404 for an unknown id', async () => {
    const response = await request(harness.app).delete('/api/transactions/64b7f1c2a1b2c3d4e5f6a7b8')

    assert.equal(response.status, 404)
  })
})
