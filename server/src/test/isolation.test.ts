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
let alice: TestClient
let bob: TestClient

before(async () => {
  harness = await createTestHarness()
})

after(async () => {
  await harness.stop()
})

beforeEach(async () => {
  await resetCollections()
  alice = await registerUser(harness.app, { name: 'Alice Adams' })
  bob = await registerUser(harness.app, { name: 'Bob Brown' })
})

describe('transactions are owned by the account that created them', () => {
  it('stores the owner on the document', async () => {
    await alice.post('/api/transactions').send(transactionPayload({ amount: 25 }))

    const { TransactionModel } = await import('../models/transaction.model.js')
    const stored = await TransactionModel.findOne({ description: 'Groceries' }).lean().exec()

    assert.ok(stored)
    assert.equal(String(stored.userId), alice.userId)
    assert.notEqual(String(stored.userId), bob.userId)
  })

  it('does not list another account\'s transactions', async () => {
    await alice.post('/api/transactions').send(transactionPayload({ description: 'Alice groceries' }))
    await bob.post('/api/transactions').send(transactionPayload({ description: 'Bob groceries' }))

    const aliceList = await alice.get('/api/transactions')
    const bobList = await bob.get('/api/transactions')

    assert.equal(aliceList.status, 200)
    assert.equal(aliceList.body.data.length, 1)
    assert.equal(aliceList.body.data[0].description, 'Alice groceries')

    assert.equal(bobList.status, 200)
    assert.equal(bobList.body.data.length, 1)
    assert.equal(bobList.body.data[0].description, 'Bob groceries')
  })

  it('hides a transaction from another account', async () => {
    const created = await alice.post('/api/transactions').send(transactionPayload())
    const id = created.body.data.id

    const response = await bob.get(`/api/transactions/${id}`)

    assert.equal(response.status, 404)
    assert.equal(response.body.success, false)
  })

  it('refuses to update a transaction that belongs to somebody else', async () => {
    const created = await alice.post('/api/transactions').send(transactionPayload({ amount: 10 }))
    const id = created.body.data.id

    const response = await bob.patch(`/api/transactions/${id}`).send({ amount: 999 })

    assert.equal(response.status, 404)

    // Alice's record is untouched.
    const check = await alice.get(`/api/transactions/${id}`)
    assert.equal(check.body.data.amount, 10)
  })

  it('refuses to delete a transaction that belongs to somebody else', async () => {
    const created = await alice.post('/api/transactions').send(transactionPayload())
    const id = created.body.data.id

    const response = await bob.delete(`/api/transactions/${id}`)

    assert.equal(response.status, 404)

    const check = await alice.get(`/api/transactions/${id}`)
    assert.equal(check.status, 200)
  })

  it('does not let a forged id reach another account', async () => {
    await alice.post('/api/transactions').send(transactionPayload())

    const response = await bob.get('/api/transactions/000000000000000000000000')

    assert.equal(response.status, 404)
  })
})

describe('budgets are owned by the account that created them', () => {
  it('does not list another account\'s budgets', async () => {
    await alice.post('/api/budgets').send({ category: 'food', limit: 300, month: 3, year: 2026 })
    await bob.post('/api/budgets').send({ category: 'food', limit: 900, month: 3, year: 2026 })

    const aliceList = await alice.get('/api/budgets?month=3&year=2026')
    const bobList = await bob.get('/api/budgets?month=3&year=2026')

    assert.equal(aliceList.body.data.length, 1)
    assert.equal(aliceList.body.data[0].limit, 300)

    assert.equal(bobList.body.data.length, 1)
    assert.equal(bobList.body.data[0].limit, 900)
  })

  it('hides a budget from another account', async () => {
    const created = await alice
      .post('/api/budgets')
      .send({ category: 'food', limit: 300, month: 3, year: 2026 })
    const id = created.body.data.id

    const response = await bob.get(`/api/budgets/${id}`)

    assert.equal(response.status, 404)
  })

  it('refuses to update a budget that belongs to somebody else', async () => {
    const created = await alice
      .post('/api/budgets')
      .send({ category: 'food', limit: 300, month: 3, year: 2026 })
    const id = created.body.data.id

    const response = await bob.patch(`/api/budgets/${id}`).send({ limit: 999 })

    assert.equal(response.status, 404)

    const check = await alice.get(`/api/budgets/${id}`)
    assert.equal(check.body.data.limit, 300)
  })

  it('refuses to delete a budget that belongs to somebody else', async () => {
    const created = await alice
      .post('/api/budgets')
      .send({ category: 'food', limit: 300, month: 3, year: 2026 })
    const id = created.body.data.id

    const response = await bob.delete(`/api/budgets/${id}`)

    assert.equal(response.status, 404)

    const check = await alice.get(`/api/budgets/${id}`)
    assert.equal(check.status, 200)
  })

  it('lets both accounts set a budget for the same category and month', async () => {
    const aliceBudget = await alice
      .post('/api/budgets')
      .send({ category: 'food', limit: 300, month: 3, year: 2026 })
    const bobBudget = await bob
      .post('/api/budgets')
      .send({ category: 'food', limit: 900, month: 3, year: 2026 })

    assert.equal(aliceBudget.status, 201)
    assert.equal(bobBudget.status, 201)
    assert.notEqual(aliceBudget.body.data.id, bobBudget.body.data.id)
  })
})

describe('budget spend is calculated per account', () => {
  it('only counts the caller\'s own transactions', async () => {
    await alice.post('/api/transactions').send(
      transactionPayload({ amount: 100, type: 'expense', category: 'food', date: '2026-03-10' }),
    )
    await bob.post('/api/transactions').send(
      transactionPayload({ amount: 400, type: 'expense', category: 'food', date: '2026-03-11' }),
    )

    await alice.post('/api/budgets').send({ category: 'food', limit: 500, month: 3, year: 2026 })
    await bob.post('/api/budgets').send({ category: 'food', limit: 500, month: 3, year: 2026 })

    const aliceBudgets = await alice.get('/api/budgets?month=3&year=2026')
    const bobBudgets = await bob.get('/api/budgets?month=3&year=2026')

    assert.equal(aliceBudgets.body.data[0].spent, 100)
    assert.equal(bobBudgets.body.data[0].spent, 400)
  })
})

describe('analytics only aggregate the caller\'s own data', () => {
  it('keeps the summary separate', async () => {
    await alice.post('/api/transactions').send(
      transactionPayload({ amount: 100, type: 'expense', category: 'food', date: daysAgo(2) }),
    )
    await bob.post('/api/transactions').send(
      transactionPayload({ amount: 900, type: 'expense', category: 'food', date: daysAgo(2) }),
    )

    const aliceSummary = await alice.get('/api/analytics/summary?range=30d')
    const bobSummary = await bob.get('/api/analytics/summary?range=30d')

    assert.equal(aliceSummary.body.data.expenses, 100)
    assert.equal(bobSummary.body.data.expenses, 900)
  })

  it('keeps the category breakdown separate', async () => {
    await alice.post('/api/transactions').send(
      transactionPayload({ amount: 100, type: 'expense', category: 'food', date: daysAgo(2) }),
    )
    await bob.post('/api/transactions').send(
      transactionPayload({ amount: 900, type: 'expense', category: 'transport', date: daysAgo(2) }),
    )

    const aliceBreakdown = await alice.get('/api/analytics/categories?range=30d')
    const bobBreakdown = await bob.get('/api/analytics/categories?range=30d')

    assert.equal(aliceBreakdown.body.data.length, 1)
    assert.equal(aliceBreakdown.body.data[0].categoryId, 'food')

    assert.equal(bobBreakdown.body.data.length, 1)
    assert.equal(bobBreakdown.body.data[0].categoryId, 'transport')
  })

  it('keeps the merchant ranking separate', async () => {
    await alice.post('/api/transactions').send(
      transactionPayload({
        amount: 100,
        type: 'expense',
        category: 'food',
        merchant: 'Alice Coffee',
        date: daysAgo(2),
      }),
    )
    await bob.post('/api/transactions').send(
      transactionPayload({
        amount: 900,
        type: 'expense',
        category: 'food',
        merchant: 'Bob Coffee',
        date: daysAgo(2),
      }),
    )

    const aliceMerchants = await alice.get('/api/analytics/merchants?range=30d')
    const bobMerchants = await bob.get('/api/analytics/merchants?range=30d')

    assert.equal(aliceMerchants.body.data.length, 1)
    assert.equal(aliceMerchants.body.data[0].name, 'Alice Coffee')

    assert.equal(bobMerchants.body.data.length, 1)
    assert.equal(bobMerchants.body.data[0].name, 'Bob Coffee')
  })

  it('keeps the cashflow series separate', async () => {
    await alice.post('/api/transactions').send(
      transactionPayload({ amount: 100, type: 'expense', category: 'food', date: daysAgo(2) }),
    )
    await bob.post('/api/transactions').send(
      transactionPayload({ amount: 900, type: 'expense', category: 'food', date: daysAgo(2) }),
    )

    const aliceCashflow = await alice.get('/api/analytics/cashflow?range=7d')
    const bobCashflow = await bob.get('/api/analytics/cashflow?range=7d')

    const aliceTotal = aliceCashflow.body.data.reduce(
      (sum: number, point: { expenses: number }) => sum + point.expenses,
      0,
    )
    const bobTotal = bobCashflow.body.data.reduce(
      (sum: number, point: { expenses: number }) => sum + point.expenses,
      0,
    )

    assert.equal(aliceTotal, 100)
    assert.equal(bobTotal, 900)
  })
})

describe('signing out stops all access', () => {
  it('locks the other routes after the session is revoked', async () => {
    await alice.post('/api/transactions').send(transactionPayload())

    await alice.post('/api/auth/logout')

    const transactions = await alice.get('/api/transactions')
    const budgets = await alice.get('/api/budgets')
    const analytics = await alice.get('/api/analytics/summary')

    assert.equal(transactions.status, 401)
    assert.equal(budgets.status, 401)
    assert.equal(analytics.status, 401)
  })
})

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}
