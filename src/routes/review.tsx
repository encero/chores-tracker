import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, QUALITY_COEFFICIENTS, type QualityRating } from '@/lib/currency'
import { ClipboardCheck, ThumbsDown, ThumbsUp, Star, Users, Check } from 'lucide-react'

export const Route = createFileRoute('/review')({
  component: ReviewPage,
})

function ReviewPage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <ReviewContent />
      </ParentLayout>
    </AuthGuard>
  )
}

function ReviewContent() {
  const forReview = useQuery(api.choreInstances.getForReview)
  const settings = useQuery(api.settings.get)

  const rateChore = useMutation(api.choreInstances.rate)
  const rateJoinedChore = useMutation(api.choreInstances.rateJoined)
  const rateParticipant = useMutation(api.choreInstances.rateParticipant)

  const [selectedChore, setSelectedChore] = useState<string | null>(null)
  const [efforts, setEfforts] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ratingChildId, setRatingChildId] = useState<string | null>(null)

  const currency = settings?.currency ?? '$'

  const selectedChoreData = forReview?.find((c) => c?._id === selectedChore)

  const initializeEfforts = (chore: NonNullable<typeof forReview>[number]) => {
    if (!chore) return
    const equalPercent = 100 / (chore.participants?.length ?? 1)
    const initial: Record<string, number> = {}
    chore.participants?.forEach((p) => {
      initial[p.childId] = equalPercent
    })
    setEfforts(initial)
  }

  const handleQuickRate = async (choreId: string, quality: QualityRating) => {
    setIsSubmitting(true)
    try {
      await rateChore({
        instanceId: choreId as Id<'choreInstances'>,
        quality,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRateParticipant = async (
    choreId: string,
    childId: string,
    quality: QualityRating
  ) => {
    setRatingChildId(childId)
    try {
      await rateParticipant({
        instanceId: choreId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
        quality,
      })
    } finally {
      setRatingChildId(null)
    }
  }

  const handleOpenJoinedReview = (chore: NonNullable<typeof forReview>[number]) => {
    if (!chore) return
    setSelectedChore(chore._id)
    initializeEfforts(chore)
    setNotes('')
  }

  const handleRateJoined = async (quality: QualityRating, forceComplete = false) => {
    if (!selectedChoreData) return

    setIsSubmitting(true)
    try {
      await rateJoinedChore({
        instanceId: selectedChoreData._id as Id<'choreInstances'>,
        quality,
        efforts: Object.entries(efforts).map(([childId, effortPercent]) => ({
          childId: childId as Id<'children'>,
          effortPercent,
        })),
        notes: notes.trim() || undefined,
        forceComplete,
      })
      setSelectedChore(null)
      setEfforts({})
      setNotes('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const adjustEffort = (childId: string, newValue: number) => {
    const participants = selectedChoreData?.participants ?? []
    const otherIds = participants.filter((p) => p.childId !== childId).map((p) => p.childId)

    if (otherIds.length === 0) return

    const remaining = 100 - newValue
    const currentOthersTotal = otherIds.reduce((sum, id) => sum + (efforts[id] ?? 0), 0)

    const newEfforts = { ...efforts, [childId]: newValue }

    if (currentOthersTotal > 0) {
      otherIds.forEach((id) => {
        newEfforts[id] = (efforts[id] / currentOthersTotal) * remaining
      })
    } else {
      const equalShare = remaining / otherIds.length
      otherIds.forEach((id) => {
        newEfforts[id] = equalShare
      })
    }

    setEfforts(newEfforts)
  }

  if (forReview === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const totalEffort = Object.values(efforts).reduce((sum, v) => sum + v, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Chores</h1>
        <p className="text-muted-foreground">
          Rate completed chores and reward the children
        </p>
      </div>

      {forReview.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck />}
          title="No chores to review"
          description="Completed chores awaiting rating will appear here"
        />
      ) : (
        <div className="space-y-4">
          {forReview.map((chore) => {
            if (!chore) return null

            const isJoined = chore.isJoined
            const doneCount = chore.doneCount ?? 0
            const totalCount = chore.totalCount ?? 0

            return (
              <Card key={chore._id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                      {chore.template?.icon ?? '📋'}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {chore.template?.name ?? 'Unknown Chore'}
                        </h3>
                        {isJoined && (
                          <Badge variant="secondary">
                            <Users className="mr-1 h-3 w-3" />
                            Joined
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        {chore.participants?.map((p) => (
                          <span
                            key={p.childId}
                            className={`flex items-center gap-1 ${
                              p.status === 'done'
                                ? 'text-green-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {p.child?.avatarEmoji} {p.child?.name}
                            {p.status === 'done' && <Check className="h-3 w-3" />}
                          </span>
                        ))}
                      </div>

                      {isJoined && (
                        <div className="mt-2">
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="bg-green-500 transition-all"
                              style={{ width: `${(doneCount / totalCount) * 100}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {doneCount}/{totalCount} completed
                          </p>
                        </div>
                      )}

                      <p className="mt-2 text-sm text-muted-foreground">
                        Due: {chore.dueDate}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(chore.totalReward, currency)}
                      </p>
                      {isJoined && (
                        <p className="text-xs text-muted-foreground">total reward</p>
                      )}
                    </div>
                  </div>

                  {/* Rating Buttons */}
                  {isJoined ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Rate each participant individually:
                      </p>
                      {chore.participants?.map((p) => {
                        const isRating = ratingChildId === p.childId
                        const alreadyRated = !!p.quality
                        const baseReward = chore.totalReward / (chore.participants?.length ?? 1)

                        return (
                          <div
                            key={p.childId}
                            className={`flex items-center gap-3 rounded-lg border p-3 ${
                              alreadyRated ? 'bg-green-50 border-green-200' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xl">{p.child?.avatarEmoji}</span>
                              <span className="font-medium">{p.child?.name}</span>
                              {p.status === 'done' && !alreadyRated && (
                                <Badge variant="reviewing" className="text-xs">Ready</Badge>
                              )}
                              {p.status === 'pending' && (
                                <Badge variant="pending" className="text-xs">Not done</Badge>
                              )}
                            </div>

                            {alreadyRated ? (
                              <div className="flex items-center gap-2">
                                <Badge variant={p.quality ?? 'default'}>
                                  {p.quality === 'excellent' && '⭐ '}
                                  {p.quality}
                                </Badge>
                                <span className="text-sm font-medium text-green-600">
                                  +{formatCurrency(p.earnedReward ?? 0, currency)}
                                </span>
                              </div>
                            ) : p.status === 'done' ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'bad')}
                                  disabled={isRating}
                                >
                                  {isRating ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  ) : (
                                    <>
                                      <ThumbsDown className="h-3 w-3" />
                                      <span className="ml-1 text-xs">{formatCurrency(Math.round(baseReward * 0.5), currency)}</span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-blue-200 text-blue-600 hover:bg-blue-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'good')}
                                  disabled={isRating}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  <span className="ml-1 text-xs">{formatCurrency(Math.round(baseReward), currency)}</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-amber-200 text-amber-600 hover:bg-amber-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'excellent')}
                                  disabled={isRating}
                                >
                                  <Star className="h-3 w-3" />
                                  <span className="ml-1 text-xs">{formatCurrency(Math.round(baseReward * 1.25), currency)}</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Waiting to complete
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleQuickRate(chore._id, 'bad')}
                        disabled={isSubmitting}
                      >
                        <ThumbsDown className="mr-1 h-4 w-4" />
                        Bad (50%)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={() => handleQuickRate(chore._id, 'good')}
                        disabled={isSubmitting}
                      >
                        <ThumbsUp className="mr-1 h-4 w-4" />
                        Good (100%)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-200 text-amber-600 hover:bg-amber-50"
                        onClick={() => handleQuickRate(chore._id, 'excellent')}
                        disabled={isSubmitting}
                      >
                        <Star className="mr-1 h-4 w-4" />
                        Excellent (125%)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Joined Chore Review Dialog */}
      <Dialog
        open={!!selectedChore}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedChore(null)
            setEfforts({})
            setNotes('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Joined Chore</DialogTitle>
            <DialogDescription>
              Adjust effort percentages and rate the overall quality
            </DialogDescription>
          </DialogHeader>

          {selectedChoreData && (
            <div className="space-y-6 py-4">
              {/* Chore Info */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
                  {selectedChoreData.template?.icon ?? '📋'}
                </div>
                <div>
                  <p className="font-semibold">
                    {selectedChoreData.template?.name ?? 'Unknown Chore'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total reward: {formatCurrency(selectedChoreData.totalReward, currency)}
                  </p>
                </div>
              </div>

              {/* Warning if not all done */}
              {!selectedChoreData.allDone && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800">
                    Not all participants have marked this chore as done:
                  </p>
                  <ul className="mt-1 text-sm text-amber-700">
                    {selectedChoreData.participants
                      ?.filter((p) => p.status !== 'done')
                      .map((p) => (
                        <li key={p.childId}>
                          {p.child?.avatarEmoji} {p.child?.name} - still pending
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-600">
                    Wait for all children to complete, or use "Force Complete" to finish anyway.
                  </p>
                </div>
              )}

              {/* Effort Sliders */}
              <div className="space-y-4">
                <Label>Effort Distribution</Label>
                {selectedChoreData.participants?.map((p) => {
                  const effort = efforts[p.childId] ?? 0

                  return (
                    <div key={p.childId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {p.child?.avatarEmoji} {p.child?.name}
                        </span>
                        <span className="font-medium">{effort.toFixed(0)}%</span>
                      </div>
                      <Slider
                        value={[effort]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([v]) => adjustEffort(p.childId, v)}
                      />
                    </div>
                  )
                })}
                {Math.abs(totalEffort - 100) > 0.1 && (
                  <p className="text-sm text-destructive">
                    Effort must total 100% (currently {totalEffort.toFixed(0)}%)
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any comments about this chore"
                />
              </div>

              {/* Preview Rewards */}
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Reward Preview</p>
                <div className="space-y-1 text-sm">
                  {selectedChoreData.participants?.map((p) => {
                    const effort = efforts[p.childId] ?? 0
                    const baseReward = (selectedChoreData.totalReward * effort) / 100

                    return (
                      <div key={p.childId} className="flex justify-between">
                        <span>
                          {p.child?.avatarEmoji} {p.child?.name}
                        </span>
                        <span className="text-muted-foreground">
                          Bad: {formatCurrency(baseReward * 0.5, currency)} /
                          Good: {formatCurrency(baseReward, currency)} /
                          Excellent: {formatCurrency(baseReward * 1.25, currency)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setSelectedChore(null)}
              className="sm:mr-auto"
            >
              Cancel
            </Button>
            {selectedChoreData?.allDone ? (
              <>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleRateJoined('bad')}
                  disabled={isSubmitting || Math.abs(totalEffort - 100) > 0.1}
                >
                  <ThumbsDown className="mr-1 h-4 w-4" />
                  Bad
                </Button>
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => handleRateJoined('good')}
                  disabled={isSubmitting || Math.abs(totalEffort - 100) > 0.1}
                >
                  <ThumbsUp className="mr-1 h-4 w-4" />
                  Good
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={() => handleRateJoined('excellent')}
                  disabled={isSubmitting || Math.abs(totalEffort - 100) > 0.1}
                >
                  <Star className="mr-1 h-4 w-4" />
                  Excellent
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="border-amber-200 text-amber-600 hover:bg-amber-50"
                onClick={() => handleRateJoined('good', true)}
                disabled={isSubmitting || Math.abs(totalEffort - 100) > 0.1}
              >
                Force Complete (Good)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
