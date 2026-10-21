import { createApp } from './app.js'
import { connectToDatabase, disconnectFromDatabase } from './config/database.js'
import { assertEnvIsValid, env } from './config/env.js'
import { seedCategories } from './services/category.service.js'

async function main(): Promise<void> {
  assertEnvIsValid()

  const app = createApp()

  try {
    await connectToDatabase()
    const created = await seedCategories()
    console.log(
      `[db] Category taxonomy ready (${created} inserted, ${env.mongoDbName} collection populated).`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (env.isProduction) {
      console.error(`[db] ${message}`)
      console.error('[api] Refusing to start in production without a working database connection.')
      process.exit(1)
    }

    // In development the server still starts so the health endpoint can
    // explain the problem, but every data route answers with 503.
    console.error(`[db] ${message}`)
    console.error('[api] Starting without a database. Data routes will return 503.')
  }

  const server = app.listen(env.port, () => {
    console.log(`[api] Spendly API listening on http://localhost:${env.port}`)
    console.log(`[api] Health probe: http://localhost:${env.port}/api/health`)
    console.log(`[api] Allowed CORS origins: ${env.corsOrigins.join(', ')}`)
  })

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[api] ${signal} received - shutting down.`)
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
