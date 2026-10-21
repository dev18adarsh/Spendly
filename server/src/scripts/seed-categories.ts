import { connectToDatabase, disconnectFromDatabase } from '../config/database.js'
import { seedCategories } from '../services/category.service.js'

/**
 * Seeds the category taxonomy into MongoDB.
 * Idempotent — running it repeatedly keeps a single row per category.
 */
async function main(): Promise<void> {
  await connectToDatabase()
  const created = await seedCategories()
  console.log(`[seed] Category taxonomy ready (${created} category rows inserted).`)
  await disconnectFromDatabase()
}

main().catch((error: unknown) => {
  console.error('[seed] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
