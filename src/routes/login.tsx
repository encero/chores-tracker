import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useContext, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Check, ChevronDown, ChevronUp, Clock, Lock, Users } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { PinPad } from '@/components/auth/PinPad'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { TTSButton } from '@/components/ui/tts-button'
import { AuthContext } from '@/components/auth/AuthGuard'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, isPinSetUp, login } = useContext(AuthContext)
  const settings = useQuery(api.settings.get)
  const todayChores = useQuery(api.choreInstances.getToday, {})
  const children = useQuery(api.children.list)

  const markDone = useMutation(api.choreInstances.markDone)
  const [marking, setMarking] = useState<string | null>(null)
  const [showPinPad, setShowPinPad] = useState(false)
  const [expandedDone, setExpandedDone] = useState<Set<string>>(new Set())

  const currency = settings?.currency ?? '$'
  const ttsLanguage = settings?.ttsLanguage ?? 'cs-CZ'

  // Redirect to setup if no PIN is set
  useEffect(() => {
    if (!isLoading && !isPinSetUp) {
      navigate({ to: '/setup' })
    }
  }, [isLoading, isPinSetUp, navigate])

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

  const toggleExpandedDone = (childId: string) => {
    setExpandedDone((prev) => {
      const next = new Set(prev)
      if (next.has(childId)) {
        next.delete(childId)
      } else {
        next.add(childId)
      }
      return next
    })
  }

  if (isLoading || settings === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Načítání...</p>
        </div>
      </div>
    )
  }

  if (!isPinSetUp) {
    return null // Will redirect to setup
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
        chore && chore.participants.some((p) => p.childId === child._id) 
      )
      if (childChores.length > 0) {
        choresByChild.set(child._id, childChores)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50">
      {/* Header with subtle parent login */}
      <header className="border-b bg-white/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="font-semibold text-purple-900">Úkoly</span>
          </div>
          {isAuthenticated ? (
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                Dashboard
              </Button>
            </Link>
          ) : showPinPad ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPinPad(false)}
              className="text-muted-foreground"
            >
              Zrušit
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPinPad(true)}
              className="text-muted-foreground"
            >
              <Lock className="mr-1 h-3 w-3" />
              Rodič
            </Button>
          )}
        </div>
      </header>

      {/* PIN Pad overlay */}
      {showPinPad && !isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl mx-4 max-w-sm w-full">
            <PinPad
              onSubmit={handleLogin}
              title="PIN rodiče"
              showRememberMe={true}
            />
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setShowPinPad(false)}
            >
              Zrušit
            </Button>
          </div>
        </div>
      )}

      <div className="container py-6">
        {/* Kid-friendly header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-purple-900 flex items-center justify-center gap-2">
            <Clock className="h-7 w-7" />
            Dnešní úkoly
            <TTSButton text="Dnešní úkoly" language={ttsLanguage} />
          </h1>
        </div>

        {/* Kid Access Links - Above the chore list */}
        {children && children.length > 0 && (
          <div className="mb-6 pb-6 border-b border-purple-200">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Klikni na své jméno:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {children.map((child) => (
                <Link
                  key={child._id}
                  to="/kid/$accessCode"
                  params={{ accessCode: child.accessCode }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-base font-medium text-purple-900 shadow-sm hover:shadow-md transition-shadow border border-purple-100"
                >
                  <span className="text-xl">{child.avatarEmoji}</span>
                  <span>{child.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!children || children.length === 0 ? (
          <Card className="border-dashed bg-white/70">
            <CardContent className="py-8 text-center text-muted-foreground">
              Zatím nejsou přidány žádné děti. Přihlas se pro začátek!
            </CardContent>
          </Card>
        ) : choresByChild.size === 0 ? (
          <Card className="border-dashed bg-white/70">
            <CardContent className="py-8 text-center">
              <span className="text-4xl">🎉</span>
              <p className="mt-2 font-medium">Na dnešek nejsou naplánovány žádné úkoly!</p>
              <p className="text-sm text-muted-foreground">Užij si volný den!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 max-w-2xl mx-auto">
            {children.map((child) => {
              const childChores = choresByChild.get(child._id)
              if (!childChores || childChores.length === 0) return null

              const pendingChores = childChores.filter(
                (c) =>
                  c?.participants.find((p) => p.childId === child._id)?.status === 'pending'
              )
              const doneChores = childChores.filter(
                (c) =>
                  c?.participants.find((p) => p.childId === child._id)?.status === 'done' ||
                  c?.status === 'completed'
              )
              const pendingCount = pendingChores.length
              const doneCount = doneChores.length
              const isDoneExpanded = expandedDone.has(child._id)

              return (
                <div key={child._id} className="bg-white/70 rounded-xl p-4 shadow-sm">
                  {/* Child Header */}
                  <Link
                    to="/kid/$accessCode"
                    params={{ accessCode: child.accessCode }}
                    className="mb-3 flex items-center gap-3 group"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-3xl shadow-sm group-hover:shadow-md transition-shadow">
                      {child.avatarEmoji}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-purple-900 group-hover:text-purple-700 transition-colors">
                        {child.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {pendingCount > 0 ? (
                          <span>{pendingCount} ke splnění</span>
                        ) : (
                          <span className="text-green-600 font-medium">Vše hotovo!</span>
                        )}
                        {doneCount > 0 && pendingCount > 0 && (
                          <span> · {doneCount} hotovo</span>
                        )}
                      </p>
                    </div>
                    <Badge variant={pendingCount > 0 ? 'pending' : 'completed'} className="text-sm">
                      {pendingCount > 0 ? `${pendingCount} zbývá` : 'Hotovo!'}
                    </Badge>
                  </Link>

                  {/* Child's Chores */}
                  <div className="space-y-2 mt-3">
                    {/* Pending chores (always visible) */}
                    {pendingChores.map((chore) => {
                      if (!chore) return null
                      const key = `${chore._id}-${child._id}`
                      const isMarking = marking === key

                      return (
                        <div
                          key={`${child._id}-${chore._id}`}
                          className="flex items-center gap-3 p-3 rounded-lg transition-colors bg-gray-50 border border-gray-100"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xl bg-white">
                            {chore.template?.icon ?? '📋'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-medium truncate">
                                {chore.template?.name ?? 'Chore'}
                              </p>
                              <TTSButton text={chore.template?.name ?? 'Chore'} language={ttsLanguage} />
                            </div>
                            {chore.isJoined && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                S{' '}
                                {chore.participants
                                  .filter((p) => p.childId !== child._id)
                                  .map((p) => p.child?.name)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-600">
                              {formatCurrency(
                                chore.isJoined
                                  ? Math.round(chore.totalReward / chore.participants.length)
                                  : chore.totalReward,
                                currency
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="h-9 px-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                            disabled={isMarking}
                            onClick={(e) => {
                              e.preventDefault()
                              handleMarkDone(chore._id, child._id)
                            }}
                          >
                            {isMarking ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Hotovo
                              </>
                            )}
                          </Button>
                        </div>
                      )
                    })}

                    {/* Done chores (collapsible) */}
                    {doneCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleExpandedDone(child._id)}
                          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isDoneExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Skrýt {doneCount} hotových
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Zobrazit {doneCount} hotových
                            </>
                          )}
                        </button>

                        {isDoneExpanded && doneChores.map((chore) => {
                          if (!chore) return null

                          return (
                            <div
                              key={`${child._id}-${chore._id}`}
                              className="flex items-center gap-3 p-3 rounded-lg transition-colors bg-green-50 border border-green-200"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xl bg-green-100">
                                {chore.template?.icon ?? '📋'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <p className="font-medium truncate text-green-800">
                                    {chore.template?.name ?? 'Chore'}
                                  </p>
                                  <TTSButton text={chore.template?.name ?? 'Chore'} language={ttsLanguage} />
                                </div>
                                {chore.isJoined && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    S{' '}
                                    {chore.participants
                                      .filter((p) => p.childId !== child._id)
                                      .map((p) => p.child?.name)
                                      .join(', ')}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-green-600">
                                  {formatCurrency(
                                    chore.isJoined
                                      ? Math.round(chore.totalReward / chore.participants.length)
                                      : chore.totalReward,
                                    currency
                                  )}
                                </p>
                              </div>
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white">
                                <Check className="h-5 w-5" />
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
