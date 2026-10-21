import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import {
  getCashflow,
  getCategoryBreakdown,
  getSummary,
} from '../services/analytics.service.js'
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

/** A fixed "now" so every expectation below can be worked out by hand. */
const NOW = new Date('2026-03-20T12:00:00.000Z')

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

describe('the reporting window', () => {
  it('counts the first instant of the window and rejects the one before it', async () => {
    // 30 days back from 2026-03-20 is 2026-02-19.
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Salary', date: '2026-02-25T10:00:00.000Z' })
    await seed({ amount: 200, type: 'expense', category: 'food', description: 'Groceries', date: '2026-03-01T10:00:00.000Z' })
    await seed({ amount: 50, type: 'expense', category: 'transport', description: 'Bus', date: '2026-02-19T00:00:00.000Z' })
    await seed({ amount: 70, type: 'expense', category: 'food', description: 'Too early', date: '2026-02-18T23:59:59.999Z' })
    await seed({ amount: 500, type: 'income', category: 'income', description: 'Old salary', date: '2026-01-10T10:00:00.000Z' })

    const summary = await getSummary(client.userId, '30d', NOW, 'UTC')

    // Inside the window: 1000 income, 200 + 50 expenses.
    assert.equal(summary.income, 1000)
    assert.equal(summary.expenses, 250)
    assert.equal(summary.balance, 750)
    assert.equal(summary.savingsRate, 75)

    // Everything on record up to the end of the window:
    // 1000 + 500 income, 200 + 50 + 70 expenses.
    assert.equal(summary.allTimeBalance, 1180)

    // The window itself.
    assert.equal(summary.period.from, '2026-02-19T00:00:00.000Z')
    assert.equal(summary.period.to, '2026-03-20T12:00:00.000Z')
    assert.equal(summary.period.days, 30)
  })

  it('measures the change against the window before it', async () => {
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Salary', date: '2026-03-01T10:00:00.000Z' })
    await seed({ amount: 500, type: 'income', category: 'income', description: 'Previous salary', date: '2026-01-20T10:00:00.000Z' })

    const summary = await getSummary(client.userId, '30d', NOW, 'UTC')

    // 1000 against 500 — twice as much.
    assert.equal(summary.changes.income.value, 100)
    assert.equal(summary.changes.income.isPositive, true)
  })

  it('measures the net of the window against the net of the one before it', async () => {
    // The window runs 2026-02-19T00:00Z to 2026-03-20T12:00Z, which is
    // 29 days and 12 hours — so the window before it starts on
    // 2026-01-20T12:00Z and ends where this one begins.
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Salary', date: '2026-03-01T10:00:00.000Z' })
    await seed({ amount: 400, type: 'expense', category: 'food', description: 'Groceries', date: '2026-03-05T10:00:00.000Z' })
    await seed({ amount: 1000, type: 'income', category: 'income', description: 'Previous salary', date: '2026-01-25T10:00:00.000Z' })
    await seed({ amount: 100, type: 'expense', category: 'transport', description: 'Bus pass', date: '2026-02-01T10:00:00.000Z' })

    const summary = await getSummary(client.userId, '30d', NOW, 'UTC')

    // This window: 1000 - 400 = 600. The one before: 1000 - 100 = 900.
    assert.equal(summary.balance, 600)
    assert.equal(summary.changes.net.value, -33.33)
    assert.equal(summary.changes.net.isPositive, false)

    // The all-time balance counts everything up to the end of the window
    // (1000 + 1000 - 400 - 100 = 1500) and is measured against what stood
    // before the window opened (1000 - 100 = 900).
    assert.equal(summary.allTimeBalance, 1500)
    assert.equal(summary.changes.balance.value, 66.67)
    assert.equal(summary.changes.balance.isPositive, true)
  })

  it('returns zeroes for an empty ledger', async () => {
    const summary = await getSummary(client.userId, '30d', NOW, 'UTC')
    const cashflow = await getCashflow(client.userId, '30d', NOW, 'UTC')
    const breakdown = await getCategoryBreakdown(client.userId, '30d', NOW, 'UTC')

    assert.equal(summary.income, 0)
    assert.equal(summary.expenses, 0)
    assert.equal(summary.balance, 0)
    assert.equal(summary.allTimeBalance, 0)
    assert.equal(summary.savingsRate, 0)

    assert.equal(cashflow.length, 30)
    assert.ok(cashflow.every((point) => point.income === 0 && point.expenses === 0 && point.balance === 0))

    assert.deepEqual(breakdown, [])
  })
})

describe('the cashflow series', () => {
  it('rolls the balance forward from everything that came before', async () => {
    await seed({ amount: 25, type: 'expense', category: 'food', description: 'Old lunch', date: '2026-01-05T10:00:00.000Z' })
    await seed({ amount: 100, type: 'income', category: 'income', description: 'Salary', date: '2026-03-18T10:00:00.000Z' })
    await seed({ amount: 40, type: 'expense', category: 'food', description: 'Lunch', date: '2026-03-19T10:00:00.000Z' })

    const cashflow = await getCashflow(client.userId, '30d', NOW, 'UTC')

    const byKey = new Map(cashflow.map((point) => [point.key, point]))

    // -25 before the window, +100 on the 18th, -40 on the 19th.
    assert.equal(byKey.get('2026-03-18')?.balance, 75)
    assert.equal(byKey.get('2026-03-19')?.balance, 35)

    const last = cashflow[cashflow.length - 1]
    assert.equal(last?.balance, 35)
  })

  it('buckets a transaction by its local date', async () => {
    // 2026-03-20T02:00Z is still 2026-03-19 in New York.
    await seed({ amount: 80, type: 'expense', category: 'food', description: 'Late dinner', date: '2026-03-20T02:00:00.000Z' })

    const newYork = await getCashflow(client.userId, '7d', NOW, 'America/New_York')
    const utc = await getCashflow(client.userId, '7d', NOW, 'UTC')

    const newYorkByKey = new Map(newYork.map((point) => [point.key, point]))
    const utcByKey = new Map(utc.map((point) => [point.key, point]))

    assert.equal(newYorkByKey.get('2026-03-19')?.expenses, 80)
    assert.equal(newYorkByKey.get('2026-03-20')?.expenses, 0)

    assert.equal(utcByKey.get('2026-03-20')?.expenses, 80)
    assert.equal(utcByKey.get('2026-03-19')?.expenses, 0)
  })

  it('starts weeks on Sunday', async () => {
    // A week runs Sunday to Saturday: 2026-03-15 (Sunday) to 2026-03-21.
    const now = new Date('2026-03-25T12:00:00.000Z')

    await seed({ amount: 30, type: 'expense', category: 'food', description: 'Sunday', date: '2026-03-15T12:00:00.000Z' })
    await seed({ amount: 60, type: 'expense', category: 'food', description: 'Saturday', date: '2026-03-21T12:00:00.000Z' })
    await seed({ amount: 70, type: 'expense', category: 'food', description: 'Next Sunday', date: '2026-03-22T12:00:00.000Z' })

    const cashflow = await getCashflow(client.userId, '90d', now, 'UTC', 'week')
    const byKey = new Map(cashflow.map((point) => [point.key, point]))

    assert.equal(byKey.get('2026-03-15')?.expenses, 90)
    assert.equal(byKey.get('2026-03-22')?.expenses, 70)
  })

  it('groups a year into calendar years', async () => {
    await seed({ amount: 700, type: 'expense', category: 'food', description: 'Old', date: '2025-06-15T12:00:00.000Z' })
    await seed({ amount: 40, type: 'expense', category: 'food', description: 'New', date: '2026-02-15T12:00:00.000Z' })

    const cashflow = await getCashflow(client.userId, '3y', NOW, 'UTC', 'year')
    const byKey = new Map(cashflow.map((point) => [point.key, point]))

    assert.equal(byKey.get('2025')?.expenses, 700)
    assert.equal(byKey.get('2026')?.expenses, 40)
  })
})
