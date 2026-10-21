import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectToDatabase, disconnectFromDatabase } from './db/mongo.js'

async function main(): Promise<void> {
  const app = createApp()

  await connectToDatabase()

  const server = app.listen(env.port, () => {
    console.log(`[api] Spendly API listening on http://localhost:${env.port}`)
    console.log(`[api] Health probe: http://localhost:${env.port}/api/health`)
  })

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[api] ${signal} received — shutting down.`)
    server.close(async () => {
      await disconnectFromDatabase()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  console.error('[api] Failed to start:', error)
  process.exit(1)
})
