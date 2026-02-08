import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'

const SESSION_KEY = 'chores_session'

interface Session {
  token: string
  expiresAt: number
}

export function useAuth() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check settings to see if PIN is set up
  const settings = useQuery(api.settings.get)

  // Verify session with the server
  const verifySession = useQuery(
    api.auth.verifySession,
    session?.token ? { token: session.token } : 'skip'
  )

  // Mutations
  const loginMutation = useMutation(api.auth.login)
  const logoutMutation = useMutation(api.auth.logout)

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Session
        // Check if session is expired locally
        if (parsed.expiresAt > Date.now()) {
          setSession(parsed)
        } else {
          localStorage.removeItem(SESSION_KEY)
        }
      } catch {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  // Check if authenticated
  const isAuthenticated = !!session && verifySession === true

  // Check if PIN is set up
  const isPinSetUp = settings?.isPinSet === true

  // Login with PIN
  const login = useCallback(
    async (pin: string, rememberMe: boolean = false): Promise<boolean> => {
      try {
        const result = await loginMutation({ pin, rememberMe })
        if (result.success && result.token && result.expiresAt) {
          const newSession: Session = {
            token: result.token,
            expiresAt: result.expiresAt,
          }
          setSession(newSession)
          localStorage.setItem(SESSION_KEY, JSON.stringify(newSession))
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [loginMutation]
  )

  // Logout - invalidates session server-side and clears local state
  const logout = useCallback(() => {
    if (session?.token) {
      logoutMutation({ token: session.token }).catch(() => {
        // Best effort - token will expire eventually even if server call fails
      })
    }
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
    navigate({ to: '/login' })
  }, [session, logoutMutation, navigate])

  return {
    isAuthenticated,
    isLoading: isLoading || settings === undefined || (verifySession === undefined && !!session),
    isPinSetUp,
    settings,
    token: session?.token,
    login,
    logout,
  }
}
