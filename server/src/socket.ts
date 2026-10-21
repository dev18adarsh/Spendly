import { randomUUID } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import { Server as SocketIOServer, type ServerOptions, type Socket } from 'socket.io'

import { SESSION_COOKIE } from './config/cookies.js'
import { env } from './config/env.js'
import { toUserDto } from './services/mappers.js'
import { resolveSession } from './services/session.service.js'
import type { TransactionDto, UserDto } from './types/api.js'

/**
 * Real-time Synchronization Module using Socket.IO
 *
 * ARCHITECTURAL NOTE FOR MULTI-INSTANCE / CLUSTERED DEPLOYMENTS:
 * Spendly uses an in-memory Socket.IO adapter by default, suitable for single-node
 * deployments. If Spendly is scaled horizontally across multiple backend instances
 * behind a load balancer, client socket connections are partitioned across processes.
 * To ensure events emitted on one instance reach sockets connected to any other instance,
 * a distributed Socket.IO adapter MUST be used, such as `@socket.io/redis-adapter`
 * (backed by Redis Pub/Sub or Redis Streams) or `@socket.io/mongo-adapter` (using
 * MongoDB Change Streams or capped collections).
 *
 * Example setup with Redis:
 * ```ts
 * import { createAdapter } from '@socket.io/redis-adapter'
 * import { createClient } from 'redis'
 *
 * const pubClient = createClient({ url: process.env.REDIS_URL })
 * const subClient = pubClient.duplicate()
 * await Promise.all([pubClient.connect(), subClient.connect()])
 * io.adapter(createAdapter(pubClient, subClient))
 * ```
 */

export const REALTIME_EVENTS = {
  TRANSACTION_CREATED: 'transaction-created',
  TRANSACTION_UPDATED: 'transaction-updated',
  TRANSACTION_DELETED: 'transaction-deleted',
} as const

export interface TransactionCreatedEvent {
  eventId: string
  id: string
  transaction: TransactionDto
  timestamp: string
}

export interface TransactionUpdatedEvent {
  eventId: string
  id: string
  transaction: TransactionDto
  timestamp: string
}

export interface TransactionDeletedEvent {
  eventId: string
  id: string
  timestamp: string
}

export interface AuthenticatedSocketData {
  user: UserDto
  userId: string
}

let io: SocketIOServer | null = null

/**
 * Extracts the session token from the socket connection handshake.
 *
 * Checks:
 * 1. `socket.handshake.auth.token` (explicitly provided token, useful for tests and programmatic clients)
 * 2. `spendly_session` cookie in `socket.handshake.headers.cookie` or `socket.request.headers.cookie`
 */
export function extractSessionToken(socket: Socket): string {
  const authToken = socket.handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim()
  }

  const cookieHeader = socket.handshake.headers.cookie ?? socket.request.headers.cookie
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return ''
  }

  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === SESSION_COOKIE) {
      return decodeURIComponent(rawValue.join('='))
    }
  }

  return ''
}

/**
 * Resolves the authenticated user-specific room name.
 * Private financial events are emitted ONLY to this room.
 */
export function getUserRoom(userId: string): string {
  return `user:${userId}`
}

/**
 * Initializes and attaches Socket.IO to the given HTTP server.
 */
export function initSocketServer(
  httpServer: HttpServer,
  options?: Partial<ServerOptions>,
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    serveClient: false,
    ...options,
  })

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = extractSessionToken(socket)
      if (!token) {
        return next(new Error('Authentication failed: Missing session token'))
      }

      const session = await resolveSession(token)
      if (!session) {
        return next(new Error('Authentication failed: Invalid or expired session'))
      }

      const user = toUserDto(session.user)
      socket.data = {
        user,
        userId: user.id,
      } satisfies AuthenticatedSocketData

      next()
    } catch (_error) {
      next(new Error('Authentication failed: Internal server error'))
    }
  })

  io.on('connection', (socket) => {
    const data = socket.data as AuthenticatedSocketData | undefined
    const userId = data?.userId

    if (!userId) {
      socket.disconnect(true)
      return
    }

    // Join the authenticated user's dedicated private room
    const userRoom = getUserRoom(userId)
    void socket.join(userRoom)
  })

  return io
}

/** Returns the active Socket.IO server instance, if initialized. */
export function getSocketServer(): SocketIOServer | null {
  return io
}

/** Gracefully closes the Socket.IO server instance. */
export async function closeSocketServer(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io?.close(() => resolve())
    })
    io = null
  }
}

/**
 * Emits a `transaction-created` event to the user's private room.
 * Never broadcasts globally.
 */
export function emitTransactionCreated(userId: string, transaction: TransactionDto): void {
  if (!io) return

  const payload: TransactionCreatedEvent = {
    eventId: randomUUID(),
    id: transaction.id,
    transaction,
    timestamp: new Date().toISOString(),
  }

  const room = getUserRoom(userId)
  io.to(room).emit(REALTIME_EVENTS.TRANSACTION_CREATED, payload)
  io.to(room).emit('transaction:created', payload)
}

/**
 * Emits a `transaction-updated` event to the user's private room.
 * Never broadcasts globally.
 */
export function emitTransactionUpdated(userId: string, transaction: TransactionDto): void {
  if (!io) return

  const payload: TransactionUpdatedEvent = {
    eventId: randomUUID(),
    id: transaction.id,
    transaction,
    timestamp: new Date().toISOString(),
  }

  const room = getUserRoom(userId)
  io.to(room).emit(REALTIME_EVENTS.TRANSACTION_UPDATED, payload)
  io.to(room).emit('transaction:updated', payload)
}

/**
 * Emits a `transaction-deleted` event to the user's private room.
 * Never broadcasts globally.
 */
export function emitTransactionDeleted(userId: string, transactionId: string): void {
  if (!io) return

  const payload: TransactionDeletedEvent = {
    eventId: randomUUID(),
    id: transactionId,
    timestamp: new Date().toISOString(),
  }

  const room = getUserRoom(userId)
  io.to(room).emit(REALTIME_EVENTS.TRANSACTION_DELETED, payload)
  io.to(room).emit('transaction:deleted', payload)
}
