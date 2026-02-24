import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { AlertCircle, Check, Clock, HandCoins, Lock, PartyPopper, Sparkles, Star, Users } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { KidLayout } from '@/components/layout/KidLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Money } from '@/components/ui/money'
import { TTSButton } from '@/components/ui/tts-button'

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
          <p className="text-lg text-purple-600">Načítání...</p>
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
            Přístupový kód nenalezen
          </h1>
          <p className="mt-2 text-muted-foreground">
            Zkontroluj prosím svůj přístupový kód a zkus to znovu
          </p>
        </div>
      </div>
    )
  }

  const currency = settings?.currency ?? '$'
  const ttsLanguage = settings?.ttsLanguage ?? 'cs-CZ'

  return (
    <KidLayout
      childName={child.name}
      avatarEmoji={child.avatarEmoji}
      balance={child.balance}
      currency={currency}
    >
      <KidDashboardContent childId={child._id as Id<'children'>} currency={currency} ttsLanguage={ttsLanguage} />
    </KidLayout>
  )
}

function KidDashboardContent({
  childId,
  currency,
  ttsLanguage,
}: {
  childId: Id<'children'>
  currency: string
  ttsLanguage: string
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
  const availableOptional = useQuery(api.scheduledChores.listAvailableOptional, { childId })

  const markDone = useMutation(api.choreInstances.markDone)
  const pickupChore = useMutation(api.scheduledChores.pickup)
  const [marking, setMarking] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState<string | null>(null)
  const [pickingUp, setPickingUp] = useState<string | null>(null)
  const [justPickedUp, setJustPickedUp] = useState<string | null>(null)

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

  const handlePickup = async (scheduledChoreId: string) => {
    setPickingUp(scheduledChoreId)
    try {
      await pickupChore({
        scheduledChoreId: scheduledChoreId as Id<'scheduledChores'>,
        childId,
      })
      setJustPickedUp(scheduledChoreId)
      setTimeout(() => setJustPickedUp(null), 2000)
    } finally {
      setPickingUp(null)
    }
  }

  if (todayChores === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    )
  }

  const myTodayChores = todayChores.filter((c) =>
    c.participants.some((p) => p.childId === childId)
  )

  const pendingChores = myTodayChores.filter(
    (c) =>
      c.status === 'pending' &&
      c.participants.find((p) => p.childId === childId)?.status === 'pending'
  )

  const completedChores = myTodayChores.filter(
    (c) =>
      c.participants.find((p) => p.childId === childId)?.status === 'done' ||
      c.status === 'completed'
  )

  const recentCompleted = upcomingChores
    ?.filter((c) => c.status === 'completed')
    .slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      {/* Today's Chores */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-purple-900">
          <Clock className="h-5 w-5" />
          Dnešní úkoly
          <TTSButton text="Dnešní úkoly" language={ttsLanguage} />
        </h2>

        {pendingChores.length === 0 && completedChores.length === 0 ? (
          <Card className="border-2 border-dashed border-purple-200 bg-white/50">
            <CardContent className="py-8 text-center">
              <span className="text-4xl">🎉</span>
              <p className="mt-2 text-lg font-medium text-purple-900">
                Dnes žádné úkoly!
              </p>
              <p className="text-muted-foreground">Užij si volný čas!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Pending Chores */}
            {pendingChores.map((chore) => {
              const myParticipation = chore.participants.find(
                (p) => p.childId === childId
              )
              const teammates = chore.participants.filter(
                (p) => p.childId !== childId
              )
              const isOverdue = chore.dueDate < today

              return (
                <Card
                  key={chore._id}
                  className={`border-2 transition-all ${
                    justCompleted === chore._id
                      ? 'border-green-400 bg-green-50'
                      : isOverdue
                        ? 'border-orange-300 bg-orange-50/50'
                        : 'border-purple-200 bg-white'
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl shadow-sm ${
                        isOverdue
                          ? 'bg-gradient-to-br from-orange-100 to-amber-100'
                          : 'bg-gradient-to-br from-purple-100 to-pink-100'
                      }`}>
                        {chore.template?.icon ?? '📋'}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <h3 className={`text-lg font-bold ${isOverdue ? 'text-orange-800' : 'text-purple-900'}`}>
                            {chore.template?.name ?? 'Chore'}
                          </h3>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs px-2 py-0.5">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Zpožděno
                            </Badge>
                          )}
                          <TTSButton
                            text={isOverdue
                              ? `${chore.template?.name ?? 'Chore'} - zpožděný úkol`
                              : chore.template?.name ?? 'Chore'
                            }
                            language={ttsLanguage}
                          />
                        </div>

                        {teammates.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>S </span>
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
                          <Money
                            cents={chore.isJoined
                              ? chore.totalReward / chore.participants.length
                              : chore.totalReward}
                            currency={currency}
                          />
                          {chore.isJoined && (
                            <span className="text-sm font-normal text-muted-foreground">
                              {' '}
                              (tvůj podíl)
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
                        <div className="flex items-center gap-1">
                          <h3 className="text-lg font-bold text-green-800">
                            {chore.template?.name ?? 'Chore'}
                          </h3>
                          <TTSButton text={chore.template?.name ?? 'Chore'} language={ttsLanguage} />
                        </div>
                        <p className="text-sm text-green-600">
                          {chore.status === 'completed'
                            ? 'Hotovo a zkontrolováno!'
                            : 'Čeká na kontrolu...'}
                        </p>
                      </div>

                      {chore.status === 'completed' && chore.quality && (
                        <Badge
                          variant={chore.quality}
                          className="text-base px-3 py-1"
                        >
                          {chore.quality === 'excellent' && '⭐ '}
                          {chore.quality === 'excellent' ? 'Výborně' :
                           chore.quality === 'good' ? 'Dobře' :
                           chore.quality === 'bad' ? 'Špatně' :
                           'Nesplněno'}
                        </Badge>
                      )}

                      {chore.status === 'pending' && (
                        <Badge variant="reviewing" className="text-base px-3 py-1">
                          <Clock className="mr-1 h-4 w-4" />
                          Čeká
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

      {/* Available Optional Chores */}
      {availableOptional && availableOptional.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-purple-900">
            <Sparkles className="h-5 w-5" />
            Dostupné extra úkoly
            <TTSButton text="Dostupné extra úkoly" language={ttsLanguage} />
          </h2>

          {/* Show message when daily chores are not done */}
          {pendingChores.length > 0 && (
            <Card className="mb-4 border-2 border-orange-300 bg-orange-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <Lock className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-orange-800">
                      Nejdřív dokonči své denní úkoly!
                    </p>
                    <p className="text-sm text-orange-600">
                      Dokonči všechny úkoly výše, abys odemkl/a extra úkoly.
                    </p>
                  </div>
                  <TTSButton
                    text="Musíš dokončit všechny své denní úkoly, než si můžeš vzít extra úkoly."
                    language={ttsLanguage}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {availableOptional.map((chore) => {
              const isLocked = pendingChores.length > 0

              return (
                <Card
                  key={chore._id}
                  className={`border-2 transition-all ${
                    justPickedUp === chore._id
                      ? 'border-green-400 bg-green-50'
                      : isLocked
                        ? 'border-gray-200 bg-gray-50/50 opacity-60'
                        : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl shadow-sm ${
                        isLocked
                          ? 'bg-gray-100'
                          : 'bg-gradient-to-br from-amber-100 to-orange-100'
                      }`}>
                        {chore.template?.icon ?? '📋'}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <h3 className={`text-lg font-bold ${isLocked ? 'text-gray-500' : 'text-amber-900'}`}>
                            {chore.template?.name ?? 'Chore'}
                          </h3>
                          <TTSButton text={chore.template?.name ?? 'Chore'} language={ttsLanguage} />
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {chore.scheduleType === 'daily' && 'Denní'}
                            {chore.scheduleType === 'weekly' && 'Týdenní'}
                            {chore.scheduleType === 'once' && 'Jednorázový'}
                            {chore.scheduleType === 'custom' && 'Vlastní'}
                          </Badge>
                          {chore.maxPickups !== undefined && (
                            <span className="text-xs">
                              {chore.pickupCount}/{chore.maxPickups} hotovo
                            </span>
                          )}
                        </div>

                        <p className={`mt-1 text-lg font-semibold ${isLocked ? 'text-gray-400' : 'text-green-600'}`}>
                          <Money cents={chore.reward} currency={currency} />
                        </p>
                      </div>

                      <Button
                        size="lg"
                        className={`h-14 px-4 rounded-xl shadow-lg ${
                          justPickedUp === chore._id
                            ? 'bg-green-500'
                            : isLocked
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                        }`}
                        onClick={() => handlePickup(chore._id)}
                        disabled={pickingUp === chore._id || justPickedUp === chore._id || isLocked}
                      >
                        {pickingUp === chore._id ? (
                          <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
                        ) : justPickedUp === chore._id ? (
                          <Check className="h-6 w-6" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <>
                            <HandCoins className="h-5 w-5 mr-2" />
                            Vzít
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent Activity */}
      {recentCompleted.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-purple-900">
            <Star className="h-5 w-5" />
            Nedávné výdělky
            <TTSButton text="Nedávné výdělky" language={ttsLanguage} />
          </h2>

          <div className="space-y-2">
            {recentCompleted.map((chore) => {
              const myParticipation = chore.myParticipation

              return (
                <Card key={chore._id} className="bg-white/70">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
                      {chore.template?.icon ?? '📋'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-medium">
                          {chore.template?.name ?? 'Chore'}
                        </p>
                        <TTSButton text={chore.template?.name ?? 'Chore'} language={ttsLanguage} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {chore.dueDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money
                        cents={myParticipation.earnedReward ?? 0}
                        currency={currency}
                        showSign
                        colorize
                        className="font-bold"
                      />
                      {chore.isJoined && myParticipation.effortPercent && (
                        <p className="text-xs text-muted-foreground">
                          {myParticipation.effortPercent.toFixed(0)}% úsilí
                        </p>
                      )}
                    </div>
                    <Badge variant={chore.quality ?? 'default'} className="text-xs">
                      {chore.quality === 'excellent' ? 'Výborně' :
                       chore.quality === 'good' ? 'Dobře' :
                       chore.quality === 'bad' ? 'Špatně' :
                       chore.quality === 'failed' ? 'Nesplněno' :
                       'N/A'}
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
