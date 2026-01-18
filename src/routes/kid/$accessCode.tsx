import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { KidLayout } from '@/components/layout/KidLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/currency'
import { Check, Clock, Users, Star, PartyPopper } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/kid/$accessCode')({
  component: KidDashboard,
})

function KidDashboard() {
  const { accessCode } = Route.useParams()

  const child = useQuery(api.children.getByAccessCode, { accessCode })
  const settings = useQuery(api.settings.get)

  if (child === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          <p className="text-lg text-purple-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (child === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50">
        <div className="text-center">
          <span className="text-6xl">🔍</span>
          <h1 className="mt-4 text-2xl font-bold text-purple-900">
            Access Code Not Found
          </h1>
          <p className="mt-2 text-muted-foreground">
            Please check your access code and try again
          </p>
        </div>
      </div>
    )
  }

  const currency = settings?.currency ?? '$'

  return (
    <KidLayout
      childName={child.name}
      avatarEmoji={child.avatarEmoji}
      balance={child.balance}
      currency={currency}
    >
      <KidDashboardContent childId={child._id} currency={currency} />
    </KidLayout>
  )
}

function KidDashboardContent({
  childId,
  currency,
}: {
  childId: Id<'children'>
  currency: string
}) {
  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

  const todayChores = useQuery(api.choreInstances.getToday, { childId })
  const upcomingChores = useQuery(api.choreInstances.getForChild, {
    childId,
    startDate: today,
    endDate: nextWeekStr,
  })

  const markDone = useMutation(api.choreInstances.markDone)
  const [marking, setMarking] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState<string | null>(null)

  const handleMarkDone = async (instanceId: string) => {
    setMarking(instanceId)
    try {
      await markDone({
        instanceId: instanceId as Id<'choreInstances'>,
        childId,
      })
      setJustCompleted(instanceId)
      setTimeout(() => setJustCompleted(null), 2000)
    } finally {
      setMarking(null)
    }
  }

  if (todayChores === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    )
  }

  const myTodayChores = todayChores?.filter((c) =>
    c?.participants?.some((p) => p.childId === childId)
  ) ?? []

  const pendingChores = myTodayChores.filter(
    (c) =>
      c?.status === 'pending' &&
      c?.participants?.find((p) => p.childId === childId)?.status === 'pending'
  )

  const completedChores = myTodayChores.filter(
    (c) =>
      c?.participants?.find((p) => p.childId === childId)?.status === 'done' ||
      c?.status === 'completed'
  )

  const recentCompleted = upcomingChores
    ?.filter((c) => c?.status === 'completed')
    .slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      {/* Today's Chores */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-purple-900">
          <Clock className="h-5 w-5" />
          Today's Chores
        </h2>

        {pendingChores.length === 0 && completedChores.length === 0 ? (
          <Card className="border-2 border-dashed border-purple-200 bg-white/50">
            <CardContent className="py-8 text-center">
              <span className="text-4xl">🎉</span>
              <p className="mt-2 text-lg font-medium text-purple-900">
                No chores for today!
              </p>
              <p className="text-muted-foreground">Enjoy your free time!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Pending Chores */}
            {pendingChores.map((chore) => {
              if (!chore) return null

              const myParticipation = chore.participants?.find(
                (p) => p.childId === childId
              )
              const teammates = chore.participants?.filter(
                (p) => p.childId !== childId
              )

              return (
                <Card
                  key={chore._id}
                  className={`border-2 transition-all ${
                    justCompleted === chore._id
                      ? 'border-green-400 bg-green-50'
                      : 'border-purple-200 bg-white'
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-3xl shadow-sm">
                        {chore.template?.icon ?? '📋'}
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-purple-900">
                          {chore.template?.name ?? 'Chore'}
                        </h3>

                        {chore.isJoined && teammates && teammates.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>With </span>
                            {teammates.map((t, i) => (
                              <span key={t.childId}>
                                {t.child?.avatarEmoji} {t.child?.name}
                                {t.status === 'done' && (
                                  <Check className="ml-0.5 inline h-3 w-3 text-green-500" />
                                )}
                                {i < teammates.length - 1 && ', '}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="mt-1 text-lg font-semibold text-green-600">
                          {formatCurrency(
                            chore.isJoined
                              ? chore.totalReward / (chore.participants?.length ?? 1)
                              : chore.totalReward,
                            currency
                          )}
                          {chore.isJoined && (
                            <span className="text-sm font-normal text-muted-foreground">
                              {' '}
                              (your share)
                            </span>
                          )}
                        </p>
                      </div>

                      <Button
                        size="lg"
                        className="h-14 w-14 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 p-0 text-2xl shadow-lg hover:from-green-600 hover:to-emerald-600"
                        onClick={() => handleMarkDone(chore._id)}
                        disabled={
                          marking === chore._id ||
                          myParticipation?.status === 'done'
                        }
                      >
                        {marking === chore._id ? (
                          <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
                        ) : justCompleted === chore._id ? (
                          <PartyPopper className="h-7 w-7" />
                        ) : (
                          <Check className="h-7 w-7" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Completed Chores */}
            {completedChores.map((chore) => {
              if (!chore) return null

              const myParticipation = chore.participants?.find(
                (p) => p.childId === childId
              )

              return (
                <Card
                  key={chore._id}
                  className="border-2 border-green-200 bg-green-50/50"
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-100 text-3xl">
                        {chore.template?.icon ?? '📋'}
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-green-800">
                          {chore.template?.name ?? 'Chore'}
                        </h3>
                        <p className="text-sm text-green-600">
                          {chore.status === 'completed'
                            ? 'Completed & Reviewed!'
                            : 'Waiting for review...'}
                        </p>
                      </div>

                      {chore.status === 'completed' && chore.quality && (
                        <Badge
                          variant={chore.quality}
                          className="text-base px-3 py-1"
                        >
                          {chore.quality === 'excellent' && '⭐ '}
                          {chore.quality.charAt(0).toUpperCase() +
                            chore.quality.slice(1)}
                        </Badge>
                      )}

                      {chore.status === 'pending' && (
                        <Badge variant="reviewing" className="text-base px-3 py-1">
                          <Clock className="mr-1 h-4 w-4" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      {recentCompleted.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-purple-900">
            <Star className="h-5 w-5" />
            Recent Earnings
          </h2>

          <div className="space-y-2">
            {recentCompleted.map((chore) => {
              if (!chore) return null

              const myParticipation = chore.myParticipation

              return (
                <Card key={chore._id} className="bg-white/70">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
                      {chore.template?.icon ?? '📋'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {chore.template?.name ?? 'Chore'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chore.dueDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        +{formatCurrency(myParticipation?.earnedReward ?? 0, currency)}
                      </p>
                      {chore.isJoined && myParticipation?.effortPercent && (
                        <p className="text-xs text-muted-foreground">
                          {myParticipation.effortPercent.toFixed(0)}% effort
                        </p>
                      )}
                    </div>
                    <Badge variant={chore.quality ?? 'default'} className="text-xs">
                      {chore.quality ?? 'N/A'}
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
