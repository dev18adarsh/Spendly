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

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

async function seed(input: Parameters<typeof transactionPayload>[0]): Promise<void> {
  await client.post('/api/transactions').send(transactionPayload(input))
}

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

describe('GET /api/analytics/summary', () => {
  it('totals income and expenses for the window', async () => {
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Salary', date: daysAgo(3) })
    await seed({ amount: 200, type: 'expense', category: 'food', description: 'Groceries', date: daysAgo(2) })
    await seed({ amount: 50, type: 'expense', category: 'transport', description: 'Bus', date: daysAgo(1) })

    const response = await client.get('/api/analytics/summary?range=30d')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.income, 1000)
    assert.equal(response.body.data.expenses, 250)
    assert.equal(response.body.data.totalBalance, 750)
    assert.equal(response.body.data.savingsRate, 75)
  })

  it('excludes transactions outside the window', async () => {
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Salary', date: daysAgo(3) })
    await seed({ amount: 5000, type: 'income', category: 'income', description: 'Old salary', date: daysAgo(200) })

    const response = await client.get('/api/analytics/summary?range=30d')

    assert.equal(response.body.data.income, 1000)
    // The balance is all-time, so the older transaction still counts.
    assert.equal(response.body.data.totalBalance, 6000)
  })

  it('compares the window with the previous one', async () => {
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Salary', date: daysAgo(3) })
    await seed({ amount: 500, type: 'income', category: 'income', description: 'Previous salary', date: daysAgo(40) })

    const response = await client.get('/api/analytics/summary?range=30d')

    assert.equal(response.body.data.changes.income.value, 100)
    assert.equal(response.body.data.changes.income.isPositive, true)
  })

  it('rejects an unknown range', async () => {
    const response = await client.get('/api/analytics/summary?range=5y')

    assert.equal(response.status, 422)
  })
})

describe('GET /api/analytics/cashflow', () => {
  it('returns one bucket per day for the 30 day window', async () => {
    await seed({ amount: 100, type: 'income', category: 'income', description: 'Salary', date: daysAgo(1) })

    const response = await client.get('/api/analytics/cashflow?range=30d')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 30)

    const withIncome = response.body.data.filter((point: { income: number }) => point.income > 0)
    assert.equal(withIncome.length, 1)
    assert.equal(withIncome[0].income, 100)
  })

  it('returns weekly buckets for the 90 day window', async () => {
    const response = await client.get('/api/analytics/cashflow?range=90d')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 13)
  })

  it('returns monthly buckets for the 12 month window', async () => {
    const response = await client.get('/api/analytics/cashflow?range=12m')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 12)
    assert.match(String(response.body.data[0].key), /^\d{4}-\d{2}$/)
  })

  it('returns daily buckets for the 7 day window', async () => {
    const response = await client.get('/api/analytics/cashflow?range=7d')

    assert.equal(response.body.data.length, 7)
  })
})

describe('GET /api/analytics/categories', () => {
  it('breaks the spend down by category with shares', async () => {
    await seed({ amount: 300, type: 'expense', category: 'food', description: 'Groceries', date: daysAgo(2) })
    await seed({ amount: 100, type: 'expense', category: 'transport', description: 'Taxi', date: daysAgo(1) })
    await seed({ amount: 900, type: 'income', category: 'income', description: 'Salary', date: daysAgo(3) })

    const response = await client.get('/api/analytics/categories?range=30d')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 2)

    const food = response.body.data[0]
    assert.equal(food.categoryId, 'food')
    assert.equal(food.name, 'Food & Dining')
    assert.equal(food.amount, 300)
    assert.equal(food.share, 0.75)
    assert.equal(food.color, '#f2b544')

    const transport = response.body.data[1]
    assert.equal(transport.amount, 100)
    assert.equal(transport.share, 0.25)
  })
})

describe('GET /api/analytics/merchants', () => {
  it('ranks merchants by spend', async () => {
    await seed({
      amount: 120,
      type: 'expense',
      category: 'food',
      description: 'Lunch',
      merchant: 'Corner Store',
      date: daysAgo(2),
    })
    await seed({
      amount: 80,
      type: 'expense',
      category: 'food',
      description: 'Coffee',
      merchant: 'Corner Store',
      date: daysAgo(1),
    })
    await seed({
      amount: 300,
      type: 'expense',
      category: 'shopping',
      description: 'Shoes',
      merchant: 'Shoe Store',
      date: daysAgo(1),
    })

    const response = await client.get('/api/analytics/merchants?range=30d&limit=5')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 2)
    assert.equal(response.body.data[0].name, 'Shoe Store')
    assert.equal(response.body.data[0].amount, 300)
    assert.equal(response.body.data[1].name, 'Corner Store')
    assert.equal(response.body.data[1].amount, 200)
    assert.equal(response.body.data[1].count, 2)
  })

  it('falls back to the description when no merchant is set', async () => {
    await seed({ amount: 25, type: 'expense', category: 'food', description: 'Bakery', date: daysAgo(1) })

    const response = await client.get('/api/analytics/merchants?range=30d')

    assert.equal(response.body.data[0].name, 'Bakery')
  })

  it('honours the limit', async () => {
    await seed({ amount: 10, type: 'expense', category: 'food', description: 'A', merchant: 'A', date: daysAgo(1) })
    await seed({ amount: 20, type: 'expense', category: 'food', description: 'B', merchant: 'B', date: daysAgo(1) })

    const response = await client.get('/api/analytics/merchants?range=30d&limit=1')

    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].name, 'B')
  })
})
