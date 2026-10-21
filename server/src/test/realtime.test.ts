import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'

import {
  createSocketTestHarness,
  registerUser,
  resetCollections,
  transactionPayload,
  type SocketTestHarness,
  type TestClient,
} from './harness.js'

function connectClientSocket(
  serverUrl: string,
  options: {
    cookie?: string
    token?: string
  } = {},
): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const extraHeaders: Record<string, string> = {}
    if (options.cookie) {
      extraHeaders.cookie = options.cookie
    }

    const socket = ioClient(serverUrl, {
      extraHeaders,
      auth: options.token ? { token: options.token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })

    const onConnect = () => {
      cleanup()
      resolve(socket)
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const cleanup = () => {
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
    }

    socket.on('connect', onConnect)
    socket.on('connect_error', onError)
  })
}

function waitForEvent<T = any>(socket: ClientSocket, eventName: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for event "${eventName}"`))
    }, timeoutMs)

    const onEvent = (payload: T) => {
      clearTimeout(timer)
      socket.off(eventName, onEvent)
      resolve(payload)
    }

    socket.on(eventName, onEvent)
  })
}

function assertNoEvent(socket: ClientSocket, eventName: string, durationMs = 300): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = (payload: unknown) => {
      socket.off(eventName, onEvent)
      reject(
        new Error(
          `Unexpected event "${eventName}" was received with payload: ${JSON.stringify(payload)}`,
        ),
      )
    }

    socket.on(eventName, onEvent)

    setTimeout(() => {
      socket.off(eventName, onEvent)
      resolve()
    }, durationMs)
  })
}

describe('Real-time synchronization with Socket.IO', () => {
  let harness: SocketTestHarness
  const openSockets: ClientSocket[] = []

  before(async () => {
    harness = await createSocketTestHarness()
  })

  after(async () => {
    for (const socket of openSockets) {
      if (socket.connected) socket.disconnect()
    }
    await harness.stop()
  })

  afterEach(async () => {
    for (const socket of openSockets) {
      if (socket.connected) socket.disconnect()
    }
    openSockets.length = 0
    await resetCollections()
  })

  function trackSocket(socket: ClientSocket): ClientSocket {
    openSockets.push(socket)
    return socket
  }

  describe('Handshake authentication', () => {
    it('rejects connection when no session token is provided', async () => {
      await assert.rejects(
        () => connectClientSocket(harness.serverUrl),
        (error: Error) => {
          assert.match(error.message, /Authentication failed/i)
          return true
        },
      )
    })

    it('rejects connection when an invalid session token is provided', async () => {
      await assert.rejects(
        () =>
          connectClientSocket(harness.serverUrl, {
            token: 'non_existent_fake_token_12345',
          }),
        (error: Error) => {
          assert.match(error.message, /Authentication failed/i)
          return true
        },
      )
    })

    it('successfully connects when a valid session cookie is provided', async () => {
      const client = await registerUser(harness.app)
      const socket = await connectClientSocket(harness.serverUrl, {
        cookie: `spendly_session=${client.sessionToken}`,
      })
      trackSocket(socket)

      assert.equal(socket.connected, true)
    })

    it('successfully connects when a valid session token is passed in handshake auth', async () => {
      const client = await registerUser(harness.app)
      const socket = await connectClientSocket(harness.serverUrl, {
        token: client.sessionToken,
      })
      trackSocket(socket)

      assert.equal(socket.connected, true)
    })
  })

  describe('Real-time synchronization between two sessions of the same user', () => {
    let userA: TestClient
    let userB: TestClient
    let socketA1: ClientSocket
    let socketA2: ClientSocket
    let socketB: ClientSocket

    beforeEach(async () => {
      userA = await registerUser(harness.app, { name: 'User A', email: 'usera@example.com' })
      userB = await registerUser(harness.app, { name: 'User B', email: 'userb@example.com' })

      // Two sessions for User A
      socketA1 = trackSocket(
        await connectClientSocket(harness.serverUrl, {
          cookie: `spendly_session=${userA.sessionToken}`,
        }),
      )
      socketA2 = trackSocket(
        await connectClientSocket(harness.serverUrl, {
          cookie: `spendly_session=${userA.sessionToken}`,
        }),
      )

      // One session for User B
      socketB = trackSocket(
        await connectClientSocket(harness.serverUrl, {
          cookie: `spendly_session=${userB.sessionToken}`,
        }),
      )
    })

    it('notifies both sessions of User A when a transaction is created, and isolates User B', async () => {
      const waitA1 = waitForEvent(socketA1, 'transaction-created')
      const waitA2 = waitForEvent(socketA2, 'transaction-created')
      const noEventForB = assertNoEvent(socketB, 'transaction-created')

      const response = await userA.post('/api/transactions').send(
        transactionPayload({
          amount: 85.5,
          category: 'food',
          description: 'Team Lunch',
        }),
      )
      assert.equal(response.status, 201)

      const [event1, event2] = await Promise.all([waitA1, waitA2, noEventForB])

      assert.equal(event1.id, response.body.data.id)
      assert.equal(event1.transaction.amount, 85.5)
      assert.equal(event1.transaction.description, 'Team Lunch')
      assert.ok(event1.eventId, 'Should contain a unique eventId')

      assert.equal(event2.id, response.body.data.id)
      assert.equal(event2.transaction.amount, 85.5)
      assert.equal(event2.transaction.description, 'Team Lunch')
      assert.equal(event2.eventId, event1.eventId)
    })

    it('notifies both sessions of User A when a transaction is updated, and isolates User B', async () => {
      const createResponse = await userA.post('/api/transactions').send(
        transactionPayload({
          amount: 50.0,
          category: 'utilities',
          description: 'Electric bill',
        }),
      )
      assert.equal(createResponse.status, 201)
      const transactionId = createResponse.body.data.id

      const waitA1 = waitForEvent(socketA1, 'transaction-updated')
      const waitA2 = waitForEvent(socketA2, 'transaction-updated')
      const noEventForB = assertNoEvent(socketB, 'transaction-updated')

      const patchResponse = await userA.patch(`/api/transactions/${transactionId}`).send({
        amount: 65.0,
        description: 'Electric bill (adjusted)',
      })
      assert.equal(patchResponse.status, 200)

      const [event1, event2] = await Promise.all([waitA1, waitA2, noEventForB])

      assert.equal(event1.id, transactionId)
      assert.equal(event1.transaction.amount, 65.0)
      assert.equal(event1.transaction.description, 'Electric bill (adjusted)')
      assert.ok(event1.eventId)

      assert.equal(event2.id, transactionId)
      assert.equal(event2.transaction.amount, 65.0)
    })

    it('notifies both sessions of User A when a transaction is deleted, and isolates User B', async () => {
      const createResponse = await userA.post('/api/transactions').send(
        transactionPayload({
          amount: 30.0,
          category: 'transport',
          description: 'Taxi fare',
        }),
      )
      assert.equal(createResponse.status, 201)
      const transactionId = createResponse.body.data.id

      const waitA1 = waitForEvent(socketA1, 'transaction-deleted')
      const waitA2 = waitForEvent(socketA2, 'transaction-deleted')
      const noEventForB = assertNoEvent(socketB, 'transaction-deleted')

      const deleteResponse = await userA.delete(`/api/transactions/${transactionId}`)
      assert.equal(deleteResponse.status, 204)

      const [event1, event2] = await Promise.all([waitA1, waitA2, noEventForB])

      assert.equal(event1.id, transactionId)
      assert.ok(event1.eventId)

      assert.equal(event2.id, transactionId)
    })

    it('does NOT emit mutation events when database operations fail', async () => {
      // 1. Failed creation: invalid negative amount
      const noCreateA1 = assertNoEvent(socketA1, 'transaction-created')
      const noCreateA2 = assertNoEvent(socketA2, 'transaction-created')
      const noCreateB = assertNoEvent(socketB, 'transaction-created')

      const failedCreate = await userA.post('/api/transactions').send(
        transactionPayload({
          amount: -50,
        }),
      )
      assert.equal(failedCreate.status, 422)
      await Promise.all([noCreateA1, noCreateA2, noCreateB])

      // 2. Failed update: unknown ID
      const noUpdateA1 = assertNoEvent(socketA1, 'transaction-updated')
      const noUpdateA2 = assertNoEvent(socketA2, 'transaction-updated')

      const fakeId = '507f1f77bcf86cd799439011'
      const failedUpdate = await userA.patch(`/api/transactions/${fakeId}`).send({
        amount: 100,
      })
      assert.equal(failedUpdate.status, 404)
      await Promise.all([noUpdateA1, noUpdateA2])

      // 3. Failed delete: unknown ID
      const noDeleteA1 = assertNoEvent(socketA1, 'transaction-deleted')
      const noDeleteA2 = assertNoEvent(socketA2, 'transaction-deleted')

      const failedDelete = await userA.delete(`/api/transactions/${fakeId}`)
      assert.equal(failedDelete.status, 404)
      await Promise.all([noDeleteA1, noDeleteA2])
    })
  })
})
