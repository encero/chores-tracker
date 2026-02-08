import type { DatabaseReader } from '../_generated/server'

/**
 * Verify a session token and throw if invalid.
 * Use this at the start of any mutation that requires parent authentication.
 */
export async function requireAuth(
  db: DatabaseReader,
  token: string | undefined
): Promise<void> {
  if (!token) {
    throw new Error('Authentication required')
  }

  const session = await db
    .query('sessions')
    .withIndex('by_token', (q) => q.eq('token', token))
    .first()

  if (!session) {
    throw new Error('Invalid session')
  }

  if (session.expiresAt < Date.now()) {
    throw new Error('Session expired')
  }
}
