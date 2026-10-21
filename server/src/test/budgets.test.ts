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

describe('GET /api/budgets/overall', () => {
  it('returns null when no overall budget is set', async () => {
    const response = await client.get('/api/budgets/overall')

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data, null)
  })

  it('returns the overall budget for the requested month', async () => {
    await client
      .put('/api/budgets/overall')
      .send({ limit: 2000, month: currentMonth, year: currentYear })

    const response = await client.get(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.limit, 2000)
    assert.equal(response.body.data.spent, 0)
    assert.equal(response.body.data.remaining, 2000)
    assert.equal(response.body.data.status, 'ok')
    assert.equal(response.body.data.month, currentMonth)
    assert.equal(response.body.data.year, currentYear)
    assert.equal(response.body.data.period, 'monthly')
  })

  it('does not return overall budget from another month', async () => {
    await client
      .put('/api/budgets/overall')
      .send({ limit: 1500, month: currentMonth, year: currentYear })

    const otherMonth = currentMonth === 1 ? 2 : 1
    const response = await client.get(
      `/api/budgets/overall?month=${otherMonth}&year=${currentYear}`,
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data, null)
  })
})

describe('PUT and POST /api/budgets/overall', () => {
  it('creates an overall budget and updates it without duplicating', async () => {
    const created = await client
      .post('/api/budgets/overall')
      .send({ limit: 1000, month: currentMonth, year: currentYear })

    assert.equal(created.status, 200)
    assert.equal(created.body.data.limit, 1000)
    assert.ok(created.body.data.id)

    const updated = await client
      .put('/api/budgets/overall')
      .send({ limit: 1200, month: currentMonth, year: currentYear })

    assert.equal(updated.status, 200)
    assert.equal(updated.body.data.id, created.body.data.id)
    assert.equal(updated.body.data.limit, 1200)

    const fetched = await client.get(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(fetched.body.data.limit, 1200)
  })

  it('calculates total spent across all categories excluding income', async () => {
    // Add expenses in different categories
    await client.post('/api/transactions').send(
      transactionPayload({
        amount: 300,
        type: 'expense',
        category: 'food',
        description: 'Groceries',
        date: new Date(Date.UTC(currentYear, currentMonth - 1, 10)).toISOString(),
      }),
    )
    await client.post('/api/transactions').send(
      transactionPayload({
        amount: 200,
        type: 'expense',
        category: 'transport',
        description: 'Train',
        date: new Date(Date.UTC(currentYear, currentMonth - 1, 12)).toISOString(),
      }),
    )
    // Add income (must be excluded!)
    await client.post('/api/transactions').send(
      transactionPayload({
        amount: 5000,
        type: 'income',
        category: 'income',
        description: 'Salary',
        date: new Date(Date.UTC(currentYear, currentMonth - 1, 1)).toISOString(),
      }),
    )

    const response = await client
      .put('/api/budgets/overall')
      .send({ limit: 1000, month: currentMonth, year: currentYear })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.spent, 500)
    assert.equal(response.body.data.remaining, 500)
    assert.equal(response.body.data.percentUsed, 50)
    assert.equal(response.body.data.status, 'ok')
  })

  it('detects approaching and exceeded overall budgets', async () => {
    await client
      .put('/api/budgets/overall')
      .send({ limit: 100, month: currentMonth, year: currentYear })

    // Spend 88 -> status is 'approaching' (>= 85%)
    await client.post('/api/transactions').send(
      transactionPayload({
        amount: 88,
        type: 'expense',
        category: 'shopping',
        description: 'Clothes',
        date: new Date(Date.UTC(currentYear, currentMonth - 1, 15)).toISOString(),
      }),
    )

    const approaching = await client.get(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(approaching.body.data.spent, 88)
    assert.equal(approaching.body.data.status, 'approaching')
    assert.equal(approaching.body.data.remaining, 12)

    // Spend 20 more -> total 108 -> status is 'over' (> 100%)
    await client.post('/api/transactions').send(
      transactionPayload({
        amount: 20,
        type: 'expense',
        category: 'entertainment',
        description: 'Movie',
        date: new Date(Date.UTC(currentYear, currentMonth - 1, 16)).toISOString(),
      }),
    )

    const over = await client.get(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(over.body.data.spent, 108)
    assert.equal(over.body.data.status, 'over')
    assert.equal(over.body.data.remaining, -8)
    assert.equal(over.body.data.percentUsed, 108)
  })

  it('rejects a negative limit for overall budget', async () => {
    const response = await client
      .put('/api/budgets/overall')
      .send({ limit: -50, month: currentMonth, year: currentYear })

    assert.equal(response.status, 422)
  })
})

describe('DELETE /api/budgets/overall', () => {
  it('removes the overall budget for the period', async () => {
    await client
      .put('/api/budgets/overall')
      .send({ limit: 1500, month: currentMonth, year: currentYear })

    const deleted = await client.delete(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(deleted.status, 204)

    const fetched = await client.get(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(fetched.body.data, null)
  })

  it('returns 404 when deleting a non-existent overall budget', async () => {
    const deleted = await client.delete(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(deleted.status, 404)
  })

  it('allows removing an overall budget by ID as well', async () => {
    const created = await client
      .put('/api/budgets/overall')
      .send({ limit: 1500, month: currentMonth, year: currentYear })

    const deleted = await client.delete(`/api/budgets/${created.body.data.id}`)
    assert.equal(deleted.status, 204)

    const fetched = await client.get(
      `/api/budgets/overall?month=${currentMonth}&year=${currentYear}`,
    )
    assert.equal(fetched.body.data, null)
  })
})

