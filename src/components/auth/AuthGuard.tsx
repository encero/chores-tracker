import { createContext, useContext, useEffect, } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  isPinSetUp: boolean
  login: (pin: string, rememberMe: boolean) => Promise<boolean>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  isPinSetUp: false,
  login: async () => {return false},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()

  return (
    <AuthContext value={auth}>
      {children}
    </AuthContext>
  )
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isPinSetUp } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading) {
      if (!isPinSetUp) {
        // No PIN set up yet, redirect to setup
        navigate({ to: '/setup' })
      } else if (!isAuthenticated) {
        // Not authenticated, redirect to login
        navigate({ to: '/login' })
      }
    }
  }, [isLoading, isAuthenticated, isPinSetUp, navigate])

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
