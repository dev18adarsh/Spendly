import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import {
  createTestHarness,
  registerUser,
  resetCollections,
  transactionPayload,
  type TestClient,
  type TestHarness,
} from './harness.js'

let harness: TestHarness
let client: TestClient

const now = new Date()
const currentMonth = now.getUTCMonth() + 1
const currentYear = now.getUTCFullYear()

before(async () => {
  harness = await createTestHarness()
})

after(async () => {
  await harness.stop()
})

beforeEach(async () => {
  await resetCollections()
  client = await registerUser(harness.app)
})

describe('GET /api/budgets', () => {
  it('returns an empty list when no budget is set', async () => {
    const response = await client.get('/api/budgets')

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.deepEqual(response.body.data, [])
  })

  it('returns the budgets for the requested month', async () => {
    await client
      .post('/api/budgets')
      .send({ category: 'food', limit: 500, month: currentMonth, year: currentYear })

    const response = await client.get(
      `/api/budgets?month=${currentMonth}&year=${currentYear}`,
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].category, 'food')
    assert.equal(response.body.data[0].limit, 500)
    assert.equal(response.body.data[0].month, currentMonth)
    assert.equal(response.body.data[0].year, currentYear)
    assert.equal(response.body.data[0].period, 'monthly')
    assert.equal(response.body.data[0].categoryName, 'Food & Dining')
  })

  it('does not return budgets from another month', async () => {
    await client
      .post('/api/budgets')
      .send({ category: 'food', limit: 500, month: currentMonth, year: currentYear })

    const otherMonth = currentMonth === 1 ? 2 : 1
    const response = await client.get(
      `/api/budgets?month=${otherMonth}&year=${currentYear}`,
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 0)
  })

  it('rejects an invalid month', async () => {
    const response = await client.get('/api/budgets?month=13')

    assert.equal(response.status, 422)
  })
})

describe('POST /api/budgets', () => {
  it('creates a budget', async () => {
    const response = await client
      .post('/api/budgets')
      .send({ category: 'transport', limit: 250.75, month: currentMonth, year: currentYear })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.category, 'transport')
    assert.equal(response.body.data.limit, 250.75)
    assert.equal(response.body.data.spent, 0)
    assert.ok(response.body.data.id)
  })

  it('reports the amount already spent in that month', async () => {
    await client
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 12.5,
          type: 'expense',
          category: 'food',
          description: 'Lunch',
          date: new Date(Date.UTC(currentYear, currentMonth - 1, 5)).toISOString(),
        }),
      )
    await client
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 7.5,
          type: 'expense',
          category: 'food',
          description: 'Dinner',
          date: new Date(Date.UTC(currentYear, currentMonth - 1, 6)).toISOString(),
        }),
      )

    await client
      .post('/api/budgets')
      .send({ category: 'food', limit: 500, month: currentMonth, year: currentYear })

    const response = await client.get(
      `/api/budgets?month=${currentMonth}&year=${currentYear}`,
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data[0].spent, 20)
  })

  it('ignores income when calculating spend', async () => {
    await client
      .post('/api/transactions')
      .send(
        transactionPayload({
          amount: 900,
          type: 'income',
          category: 'income',
          description: 'Paycheck',
          date: new Date(Date.UTC(currentYear, currentMonth - 1, 1)).toISOString(),
        }),
      )

    await client
      .post('/api/budgets')
      .send({ category: 'income', limit: 5000, month: currentMonth, year: currentYear })

    const response = await client.get(
      `/api/budgets?month=${currentMonth}&year=${currentYear}`,
    )

    assert.equal(response.body.data[0].spent, 0)
  })

  it('rejects an unknown category', async () => {
    const response = await client
      .post('/api/budgets')
      .send({ category: 'nope', limit: 100, month: currentMonth, year: currentYear })

    assert.equal(response.status, 422)
  })

  it('rejects a negative limit', async () => {
    const response = await client
      .post('/api/budgets')
      .send({ category: 'food', limit: -1, month: currentMonth, year: currentYear })

    assert.equal(response.status, 422)
  })
})

describe('PUT /api/budgets', () => {
  it('updates an existing budget instead of duplicating it', async () => {
    const first = await client
      .put('/api/budgets')
      .send({ category: 'food', limit: 500, month: currentMonth, year: currentYear })

    assert.equal(first.status, 200)

    const second = await client
      .put('/api/budgets')
      .send({ category: 'food', limit: 650, month: currentMonth, year: currentYear })

    assert.equal(second.status, 200)
    assert.equal(second.body.data.id, first.body.data.id)
    assert.equal(second.body.data.limit, 650)

    const list = await client.get(
      `/api/budgets?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(list.body.data.length, 1)
  })
})

describe('PATCH /api/budgets/:id', () => {
  it('updates the limit of a budget', async () => {
    const created = await client
      .post('/api/budgets')
      .send({ category: 'shopping', limit: 300, month: currentMonth, year: currentYear })

    const response = await client
      .patch(`/api/budgets/${created.body.data.id}`)
      .send({ limit: 425 })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.limit, 425)
    assert.equal(response.body.data.category, 'shopping')
  })

  it('returns 404 for an unknown id', async () => {
    const response = await client
      .patch('/api/budgets/64b7f1c2a1b2c3d4e5f6a7b8')
      .send({ limit: 100 })

    assert.equal(response.status, 404)
  })
})

describe('DELETE /api/budgets/:id', () => {
  it('removes the budget', async () => {
    const created = await client
      .post('/api/budgets')
      .send({ category: 'health', limit: 120, month: currentMonth, year: currentYear })

    const deleted = await client.delete(`/api/budgets/${created.body.data.id}`)
    assert.equal(deleted.status, 204)

    const list = await client.get(
      `/api/budgets?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(list.body.data.length, 0)
  })
})
