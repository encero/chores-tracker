import { useContext } from 'react'
import { AuthContext } from '@/components/auth/AuthGuard'

/**
 * Returns the current auth token, for passing to authenticated Convex mutations.
 * Must be used within an AuthGuard.
 */
export function useAuthToken(): string | undefined {
  const { token } = useContext(AuthContext)
  return token
}
