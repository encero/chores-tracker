import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { PinSetup } from '@/components/auth/PinSetup'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})

function SetupPage() {
  const navigate = useNavigate()
  const { isLoading, isPinSetUp } = useAuth()
  const initializeSettings = useMutation(api.settings.initialize)

  // Redirect to login if PIN is already set
  useEffect(() => {
    if (!isLoading && isPinSetUp) {
      navigate({ to: '/login' })
    }
  }, [isLoading, isPinSetUp, navigate])

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

  if (isPinSetUp) {
    return null // Will redirect to login
  }

  const handleSetup = async (pin: string) => {
    await initializeSettings({ pin })
    navigate({ to: '/login' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-6xl">🏠</span>
          <h1 className="mt-4 text-3xl font-bold">Welcome to Chores Tracker</h1>
          <p className="mt-2 text-muted-foreground">
            Let's set up your parent PIN to get started
          </p>
        </div>

        <PinSetup onComplete={handleSetup} />
      </div>
    </div>
  )
}
