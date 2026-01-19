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
import { Money } from '@/components/ui/money'
import { ClipboardCheck, ThumbsDown, ThumbsUp, Star, Users, Check, Settings2, X, Undo2, CheckCircle2 } from 'lucide-react'

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

  const rateJoinedChore = useMutation(api.choreInstances.rateJoined)
  const rateParticipant = useMutation(api.choreInstances.rateParticipant)
  const rateAllParticipants = useMutation(api.choreInstances.rateAllParticipants)
  const unmarkDone = useMutation(api.choreInstances.unmarkDone)
  const markDone = useMutation(api.choreInstances.markDone)

  const [selectedChore, setSelectedChore] = useState<string | null>(null)
  const [unmarkingChildId, setUnmarkingChildId] = useState<string | null>(null)
  const [markingDoneChildId, setMarkingDoneChildId] = useState<string | null>(null)
  const [efforts, setEfforts] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ratingChildId, setRatingChildId] = useState<string | null>(null)

  // State for "Rate All" dialog
  const [rateAllChore, setRateAllChore] = useState<string | null>(null)
  const [rateAllQualities, setRateAllQualities] = useState<Record<string, QualityRating>>({})
  const [rateAllEfforts, setRateAllEfforts] = useState<Record<string, number>>({})
  const [rateAllNotes, setRateAllNotes] = useState('')

  // State for individual rating with custom participation
  const [customEffortChild, setCustomEffortChild] = useState<{ choreId: string; childId: string } | null>(null)
  const [customEffortValue, setCustomEffortValue] = useState(50)

  const currency = settings?.currency ?? '$'

  const selectedChoreData = forReview?.find((c) => c?._id === selectedChore)
  const rateAllChoreData = forReview?.find((c) => c?._id === rateAllChore)

  const initializeEfforts = (chore: NonNullable<typeof forReview>[number]) => {
    if (!chore) return
    const equalPercent = 100 / (chore.participants?.length ?? 1)
    const initial: Record<string, number> = {}
    chore.participants?.forEach((p) => {
      initial[p.childId] = equalPercent
    })
    setEfforts(initial)
  }

  const handleRateParticipant = async (
    choreId: string,
    childId: string,
    quality: QualityRating,
    effortPercent?: number
  ) => {
    setRatingChildId(childId)
    try {
      await rateParticipant({
        instanceId: choreId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
        quality,
        effortPercent,
      })
      setCustomEffortChild(null)
    } finally {
      setRatingChildId(null)
    }
  }

  const handleUnmarkDone = async (choreId: string, childId: string) => {
    setUnmarkingChildId(childId)
    try {
      await unmarkDone({
        instanceId: choreId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
      })
    } finally {
      setUnmarkingChildId(null)
    }
  }

  const handleMarkDone = async (choreId: string, childId: string) => {
    setMarkingDoneChildId(childId)
    try {
      await markDone({
        instanceId: choreId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
      })
    } finally {
      setMarkingDoneChildId(null)
    }
  }

  const initializeRateAll = (chore: NonNullable<typeof forReview>[number]) => {
    if (!chore) return
    const equalPercent = 100 / (chore.participants?.length ?? 1)
    const qualities: Record<string, QualityRating> = {}
    const efforts: Record<string, number> = {}
    chore.participants?.forEach((p) => {
      qualities[p.childId] = 'good'
      efforts[p.childId] = equalPercent
    })
    setRateAllQualities(qualities)
    setRateAllEfforts(efforts)
    setRateAllNotes('')
    setRateAllChore(chore._id)
  }

  const handleRateAll = async () => {
    if (!rateAllChoreData) return

    setIsSubmitting(true)
    try {
      const ratings = Object.entries(rateAllQualities).map(([childId, quality]) => ({
        childId: childId as Id<'children'>,
        quality,
        effortPercent: rateAllEfforts[childId] ?? 0,
      }))

      await rateAllParticipants({
        instanceId: rateAllChoreData._id as Id<'choreInstances'>,
        ratings,
        notes: rateAllNotes.trim() || undefined,
      })
      setRateAllChore(null)
      setRateAllQualities({})
      setRateAllEfforts({})
      setRateAllNotes('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const adjustRateAllEffort = (childId: string, newValue: number) => {
    const participants = rateAllChoreData?.participants ?? []
    const otherIds = participants.filter((p) => p.childId !== childId).map((p) => p.childId)

    if (otherIds.length === 0) return

    const remaining = 100 - newValue
    const currentOthersTotal = otherIds.reduce((sum, id) => sum + (rateAllEfforts[id] ?? 0), 0)

    const newEfforts = { ...rateAllEfforts, [childId]: newValue }

    if (currentOthersTotal > 0) {
      otherIds.forEach((id) => {
        newEfforts[id] = (rateAllEfforts[id] / currentOthersTotal) * remaining
      })
    } else {
      const equalShare = remaining / otherIds.length
      otherIds.forEach((id) => {
        newEfforts[id] = equalShare
      })
    }

    setRateAllEfforts(newEfforts)
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
            const isMultiKid = (chore.participants?.length ?? 0) > 1
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
                        {isMultiKid && !isJoined && (
                          <Badge variant="outline">
                            <Users className="mr-1 h-3 w-3" />
                            {chore.participants?.length} kids
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

                      {isMultiKid && (
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
                        <Money cents={chore.totalReward} currency={currency} />
                      </p>
                      {isJoined ? (
                        <p className="text-xs text-muted-foreground">pooled reward</p>
                      ) : isMultiKid ? (
                        <p className="text-xs text-muted-foreground">per kid</p>
                      ) : null}
                    </div>
                  </div>

                  {/* Rating Buttons */}
                  {/* Unified participant-based rating UI */}
                  <div className="mt-4 space-y-3">
                    {isMultiKid && chore.participants?.every(p => p.status === 'done') && !chore.participants?.some(p => p.quality) && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => initializeRateAll(chore)}
                        >
                          <Users className="mr-1 h-4 w-4" />
                          Rate All at Once
                        </Button>
                      </div>
                    )}
                    {chore.participants?.map((p) => {
                      const isRating = ratingChildId === p.childId
                      const alreadyRated = !!p.quality
                      const numParticipants = chore.participants?.length ?? 1
                      const isCustomEffort = isJoined && customEffortChild?.choreId === chore._id && customEffortChild?.childId === p.childId
                      // For joined: reward is split by effort. For non-joined: full reward per kid
                      const baseReward = isJoined
                        ? (isCustomEffort
                            ? chore.totalReward * (customEffortValue / 100)
                            : chore.totalReward / numParticipants)
                        : chore.totalReward

                      return (
                        <div
                          key={p.childId}
                          className={`rounded-lg border ${
                            alreadyRated ? 'bg-green-50 border-green-200' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xl">{p.child?.avatarEmoji}</span>
                              <span className="font-medium">{p.child?.name}</span>
                              {p.status === 'done' && !alreadyRated && (
                                <Badge variant="reviewing" className="text-xs">Ready</Badge>
                              )}
                              {p.status === 'pending' && (
                                <Badge variant="pending" className="text-xs">Not done</Badge>
                              )}
                              {alreadyRated && p.effortPercent !== undefined && isJoined && (
                                <span className="text-xs text-muted-foreground">
                                  ({p.effortPercent.toFixed(0)}%)
                                </span>
                              )}
                            </div>

                            {alreadyRated ? (
                              <div className="flex items-center gap-2">
                                <Badge variant={p.quality ?? 'default'}>
                                  {p.quality === 'excellent' && '⭐ '}
                                  {p.quality}
                                </Badge>
                                <Money
                                  cents={p.earnedReward ?? 0}
                                  currency={currency}
                                  showSign
                                  colorize
                                  className="text-sm font-medium"
                                />
                              </div>
                            ) : p.status === 'done' ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                  onClick={() => handleUnmarkDone(chore._id, p.childId)}
                                  disabled={unmarkingChildId === p.childId}
                                  title="Mark as not done"
                                >
                                  {unmarkingChildId === p.childId ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  ) : (
                                    <Undo2 className="h-4 w-4" />
                                  )}
                                </Button>
                                {isJoined && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${isCustomEffort ? 'bg-purple-100' : ''}`}
                                    onClick={() => {
                                      if (isCustomEffort) {
                                        setCustomEffortChild(null)
                                      } else {
                                        setCustomEffortChild({ choreId: chore._id, childId: p.childId })
                                        setCustomEffortValue(100 / numParticipants)
                                      }
                                    }}
                                    title="Set custom participation %"
                                  >
                                    <Settings2 className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-gray-300 text-gray-600 hover:bg-gray-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'failed', isCustomEffort ? customEffortValue : undefined)}
                                  disabled={isRating}
                                  title="Failed (0%)"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'bad', isCustomEffort ? customEffortValue : undefined)}
                                  disabled={isRating}
                                >
                                  {isRating ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  ) : (
                                    <>
                                      <ThumbsDown className="h-3 w-3" />
                                      <span className="ml-1 text-xs hidden sm:inline"><Money cents={Math.round(baseReward * 0.5)} currency={currency} /></span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-blue-200 text-blue-600 hover:bg-blue-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'good', isCustomEffort ? customEffortValue : undefined)}
                                  disabled={isRating}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  <span className="ml-1 text-xs hidden sm:inline"><Money cents={Math.round(baseReward)} currency={currency} /></span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-amber-200 text-amber-600 hover:bg-amber-50 h-8 px-2"
                                  onClick={() => handleRateParticipant(chore._id, p.childId, 'excellent', isCustomEffort ? customEffortValue : undefined)}
                                  disabled={isRating}
                                >
                                  <Star className="h-3 w-3" />
                                  <span className="ml-1 text-xs hidden sm:inline"><Money cents={Math.round(baseReward * 1.25)} currency={currency} /></span>
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-green-200 text-green-600 hover:bg-green-50 h-8 px-2"
                                onClick={() => handleMarkDone(chore._id, p.childId)}
                                disabled={markingDoneChildId === p.childId}
                                title="Mark as done"
                              >
                                {markingDoneChildId === p.childId ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Mark Done
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Custom participation slider */}
                          {isCustomEffort && p.status === 'done' && !alreadyRated && (
                            <div className="px-3 pb-3 pt-0">
                              <div className="flex items-center gap-3 rounded-lg bg-purple-50 p-2">
                                <span className="text-xs text-purple-700">Participation:</span>
                                <Slider
                                  value={[customEffortValue]}
                                  min={0}
                                  max={100}
                                  step={5}
                                  onValueChange={([v]) => setCustomEffortValue(v)}
                                  className="flex-1"
                                />
                                <span className="text-sm font-medium text-purple-700 w-12 text-right">
                                  {customEffortValue}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                    Total reward: <Money cents={selectedChoreData.totalReward} currency={currency} />
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
                          Bad: <Money cents={baseReward * 0.5} currency={currency} /> /
                          Good: <Money cents={baseReward} currency={currency} /> /
                          Excellent: <Money cents={baseReward * 1.25} currency={currency} />
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

      {/* Rate All Participants Dialog */}
      <Dialog
        open={!!rateAllChore}
        onOpenChange={(open) => {
          if (!open) {
            setRateAllChore(null)
            setRateAllQualities({})
            setRateAllEfforts({})
            setRateAllNotes('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate All Participants</DialogTitle>
            <DialogDescription>
              Set individual ratings and participation percentages for each child
            </DialogDescription>
          </DialogHeader>

          {rateAllChoreData && (
            <div className="space-y-6 py-4">
              {/* Chore Info */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
                  {rateAllChoreData.template?.icon ?? '📋'}
                </div>
                <div>
                  <p className="font-semibold">
                    {rateAllChoreData.template?.name ?? 'Unknown Chore'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total reward: <Money cents={rateAllChoreData.totalReward} currency={currency} />
                  </p>
                </div>
              </div>

              {/* Individual Ratings */}
              <div className="space-y-4">
                <Label>Rate Each Participant</Label>
                {rateAllChoreData.participants?.map((p) => {
                  const quality = rateAllQualities[p.childId] ?? 'good'
                  const effort = rateAllEfforts[p.childId] ?? 0
                  const coefficient = QUALITY_COEFFICIENTS[quality]
                  // For joined: reward is split by effort. For non-joined: full reward per kid
                  const earnedReward = rateAllChoreData.isJoined
                    ? Math.round((rateAllChoreData.totalReward * effort / 100) * coefficient)
                    : Math.round(rateAllChoreData.totalReward * coefficient)

                  return (
                    <div key={p.childId} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          {p.child?.avatarEmoji} {p.child?.name}
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          <Money cents={earnedReward} currency={currency} />
                        </span>
                      </div>

                      {/* Quality Rating */}
                      <div className="grid grid-cols-4 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'failed' ? 'border-gray-500 bg-gray-100 text-gray-700' : 'border-gray-300 text-gray-500'}`}
                          onClick={() => setRateAllQualities(prev => ({ ...prev, [p.childId]: 'failed' }))}
                        >
                          <X className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Fail</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'bad' ? 'border-red-500 bg-red-50 text-red-700' : 'border-red-200 text-red-600'}`}
                          onClick={() => setRateAllQualities(prev => ({ ...prev, [p.childId]: 'bad' }))}
                        >
                          <ThumbsDown className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Bad</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'good' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-200 text-blue-600'}`}
                          onClick={() => setRateAllQualities(prev => ({ ...prev, [p.childId]: 'good' }))}
                        >
                          <ThumbsUp className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Good</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'excellent' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-amber-200 text-amber-600'}`}
                          onClick={() => setRateAllQualities(prev => ({ ...prev, [p.childId]: 'excellent' }))}
                        >
                          <Star className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Excellent</span>
                        </Button>
                      </div>

                      {/* Effort Slider - only for joined chores */}
                      {rateAllChoreData.isJoined && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-20">Participation:</span>
                          <Slider
                            value={[effort]}
                            min={0}
                            max={100}
                            step={5}
                            onValueChange={([v]) => adjustRateAllEffort(p.childId, v)}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-12 text-right">
                            {effort.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {rateAllChoreData.isJoined && Math.abs(Object.values(rateAllEfforts).reduce((sum, v) => sum + v, 0) - 100) > 0.1 && (
                  <p className="text-sm text-destructive">
                    Participation must total 100% (currently {Object.values(rateAllEfforts).reduce((sum, v) => sum + v, 0).toFixed(0)}%)
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="rateAllNotes">Notes (optional)</Label>
                <Input
                  id="rateAllNotes"
                  value={rateAllNotes}
                  onChange={(e) => setRateAllNotes(e.target.value)}
                  placeholder="Any comments about this chore"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRateAllChore(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRateAll}
              disabled={isSubmitting || (rateAllChoreData?.isJoined && Math.abs(Object.values(rateAllEfforts).reduce((sum, v) => sum + v, 0) - 100) > 0.1)}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              ) : null}
              Submit Ratings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
