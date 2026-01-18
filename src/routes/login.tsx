import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { PinPad } from '@/components/auth/PinPad'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { Check, Clock, Users } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, isPinSetUp, login } = useAuth()
  const settings = useQuery(api.settings.get)
  const todayChores = useQuery(api.choreInstances.getToday, {})
  const children = useQuery(api.children.list)

  const markDone = useMutation(api.choreInstances.markDone)
  const [marking, setMarking] = useState<string | null>(null)

  const currency = settings?.currency ?? '$'

  // Redirect to setup if no PIN is set
  useEffect(() => {
    if (!isLoading && !isPinSetUp) {
      navigate({ to: '/setup' })
    }
  }, [isLoading, isPinSetUp, navigate])

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/' })
    }
  }, [isLoading, isAuthenticated, navigate])

  const handleMarkDone = async (instanceId: string, childId: string) => {
    const key = `${instanceId}-${childId}`
    setMarking(key)
    try {
      await markDone({
        instanceId: instanceId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
      })
    } finally {
      setMarking(null)
    }
  }

  if (isLoading || settings === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isPinSetUp) {
    return null // Will redirect to setup
  }

  if (isAuthenticated) {
    return null // Will redirect to dashboard
  }

  const handleLogin = async (pin: string, rememberMe: boolean) => {
    const success = await login(pin, rememberMe)
    if (success) {
      navigate({ to: '/' })
    }
    return success
  }

  // Group chores by child
  const choresByChild = new Map<string, typeof todayChores>()
  if (children && todayChores) {
    for (const child of children) {
      const childChores = todayChores.filter((chore) =>
        chore?.participants?.some((p) => p.childId === child._id)
      )
      if (childChores.length > 0) {
        choresByChild.set(child._id, childChores)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left side - Today's Chores */}
          <div className="order-2 lg:order-1">
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Clock className="h-6 w-6" />
                Today's Chores
              </h2>
              <p className="text-muted-foreground">
                Quick overview for everyone
              </p>
            </div>

            {!children || children.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No children added yet. Log in to get started!
                </CardContent>
              </Card>
            ) : choresByChild.size === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <span className="text-4xl">🎉</span>
                  <p className="mt-2 font-medium">No chores scheduled for today!</p>
                  <p className="text-sm text-muted-foreground">Enjoy your day off!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {children?.map((child) => {
                  const childChores = choresByChild.get(child._id)
                  if (!childChores || childChores.length === 0) return null

                  const pendingCount = childChores.filter(
                    (c) =>
                      c?.participants?.find((p) => p.childId === child._id)?.status === 'pending'
                  ).length
                  const doneCount = childChores.length - pendingCount

                  return (
                    <div key={child._id}>
                      {/* Child Header */}
                      <Link
                        to={`/kid/${child.accessCode}`}
                        className="mb-3 flex items-center gap-3 group"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-2xl shadow-sm group-hover:shadow-md transition-shadow">
                          {child.avatarEmoji}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {child.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {pendingCount > 0 ? (
                              <span>{pendingCount} pending</span>
                            ) : (
                              <span className="text-green-600">All done!</span>
                            )}
                            {doneCount > 0 && pendingCount > 0 && (
                              <span> · {doneCount} completed</span>
                            )}
                          </p>
                        </div>
                        <Badge variant={pendingCount > 0 ? 'pending' : 'completed'}>
                          {pendingCount > 0 ? `${pendingCount} to do` : 'Done'}
                        </Badge>
                      </Link>

                      {/* Child's Chores */}
                      <div className="space-y-2 pl-2 border-l-2 border-muted ml-6">
                        {childChores.map((chore) => {
                          if (!chore) return null
                          const myParticipation = chore.participants?.find(
                            (p) => p.childId === child._id
                          )
                          const isDone = myParticipation?.status === 'done' || chore.status === 'completed'
                          const key = `${chore._id}-${child._id}`
                          const isMarking = marking === key

                          return (
                            <Card
                              key={`${child._id}-${chore._id}`}
                              className={`transition-colors ${
                                isDone ? 'bg-green-50/50 border-green-200' : ''
                              }`}
                            >
                              <CardContent className="flex items-center gap-3 py-3">
                                <div
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                                    isDone ? 'bg-green-100' : 'bg-gray-100'
                                  }`}
                                >
                                  {chore.template?.icon ?? '📋'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`font-medium truncate ${
                                      isDone ? 'text-green-800' : ''
                                    }`}
                                  >
                                    {chore.template?.name ?? 'Chore'}
                                  </p>
                                  {chore.isJoined && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      With{' '}
                                      {chore.participants
                                        ?.filter((p) => p.childId !== child._id)
                                        .map((p) => p.child?.name)
                                        .join(', ')}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-green-600">
                                    {formatCurrency(
                                      chore.isJoined
                                        ? Math.round(chore.totalReward / (chore.participants?.length ?? 1))
                                        : chore.totalReward,
                                      currency
                                    )}
                                  </p>
                                </div>
                                {isDone ? (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
                                    <Check className="h-5 w-5" />
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3"
                                    disabled={isMarking}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleMarkDone(chore._id, child._id)
                                    }}
                                  >
                                    {isMarking ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4 mr-1" />
                                        Done
                                      </>
                                    )}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Kid Access Links */}
            {children && children.length > 0 && (
              <div className="mt-8 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Quick access for kids:
                </p>
                <div className="flex flex-wrap gap-2">
                  {children.map((child) => (
                    <Link
                      key={child._id}
                      to={`/kid/${child.accessCode}`}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-2 text-sm font-medium text-purple-900 hover:from-purple-200 hover:to-pink-200 transition-colors"
                    >
                      <span>{child.avatarEmoji}</span>
                      <span>{child.name}'s Dashboard</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right side - Login */}
          <div className="order-1 lg:order-2">
            <div className="sticky top-8">
              <div className="mb-8 text-center">
                <span className="text-6xl">🏠</span>
                <h1 className="mt-4 text-3xl font-bold">Chores Tracker</h1>
                <p className="mt-2 text-muted-foreground">
                  Enter your PIN to access parent controls
                </p>
              </div>

              <PinPad
                onSubmit={handleLogin}
                title="Enter PIN"
                showRememberMe={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
