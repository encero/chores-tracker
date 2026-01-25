import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

// Local backend URL (from convex dev --local, runs on port 3210)
const convexUrl = process.env.VITE_CONVEX_URL || 'http://127.0.0.1:3210'

const client = new ConvexHttpClient(convexUrl)

export async function resetAndSeedDatabase() {
  await client.mutation(api.testing.resetDatabase, {})
  await client.mutation(api.testing.seedTestData, {})
}

export async function resetDatabase() {
  await client.mutation(api.testing.resetDatabase, {})
}
