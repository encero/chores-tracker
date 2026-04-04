import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Settings2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { QualityRating } from '@/lib/currency'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Money } from '@/components/ui/money'
import { Slider } from '@/components/ui/slider'
import {
  calculateBaseRewardForDisplay,
  calculateDisplayedRewardForQuality,
  calculateRateAllEarnedReward,
  initializeEqualEfforts,
  redistributeEfforts,
  validateEffortTotal,
} from '@/lib/reward'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <DashboardContent />
      </ParentLayout>
    </AuthGuard>
  )
}

function DashboardContent() {
  const children = useQuery(api.children.list)
  const todayChores = useQuery(api.choreInstances.getToday, {})
  const templatesResult = useQuery(api.choreTemplates.list, {})
  const settings = useQuery(api.settings.get)

  const templates = templatesResult?.items

  const markDone = useMutation(api.choreInstances.markDone)
  const unmarkDone = useMutation(api.choreInstances.unmarkDone)
  const rateParticipant = useMutation(api.choreInstances.rateParticipant)
  const rateAllParticipants = useMutation(
    api.choreInstances.rateAllParticipants,
  )
  const markMissed = useMutation(api.choreInstances.markMissed)
  const createSchedule = useMutation(api.scheduledChores.create)

  const [marking, setMarking] = useState<string | null>(null)
  const [unmarking, setUnmarking] = useState<string | null>(null)
  const [rating, setRating] = useState<string | null>(null)
  const [markingMissedId, setMarkingMissedId] = useState<string | null>(null)
  const [quickAssignOpen, setQuickAssignOpen] = useState(false)
  const [selectedChildren, setSelectedChildren] = useState<Array<string>>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [reward, setReward] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [rateAllChore, setRateAllChore] = useState<string | null>(null)
  const [rateAllQualities, setRateAllQualities] = useState<
    Record<string, QualityRating>
  >({})
  const [rateAllEfforts, setRateAllEfforts] = useState<Record<string, number>>(
    {},
  )
  const [rateAllNotes, setRateAllNotes] = useState('')
  const [isSubmittingRatings, setIsSubmittingRatings] = useState(false)
  const [customEffortChild, setCustomEffortChild] = useState<{
    choreId: string
    childId: string
  } | null>(null)
  const [customEffortValue, setCustomEffortValue] = useState(50)

  const currency = settings?.currency ?? '$'
  const today = new Date().toISOString().split('T')[0]
  const getParticipantKey = (instanceId: string, childId: string) =>
    `${instanceId}-${childId}`

  const resetQuickAssign = () => {
    setSelectedChildren([])
    setSelectedTemplate('')
    setReward('')
    setIsJoined(false)
  }

  const resetRateAllDialog = () => {
    setRateAllChore(null)
    setRateAllQualities({})
    setRateAllEfforts({})
    setRateAllNotes('')
  }

  const toggleChild = (childId: string) => {
    setSelectedChildren((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId],
    )
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates?.find((t) => t._id === templateId)
    if (template) {
      setReward((template.defaultReward / 100).toFixed(2))
    }
  }

  const handleQuickAssign = async () => {
    if (!selectedTemplate || selectedChildren.length === 0) return

    setIsAssigning(true)
    try {
      await createSchedule({
        childIds: selectedChildren as Array<Id<'children'>>,
        choreTemplateId: selectedTemplate as Id<'choreTemplates'>,
        reward: Math.round(parseFloat(reward || '0') * 100),
        isJoined: isJoined && selectedChildren.length > 1,
        scheduleType: 'once',
        startDate: today,
        isOptional: false,
      })
      resetQuickAssign()
      setQuickAssignOpen(false)
    } finally {
      setIsAssigning(false)
    }
  }

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

  const handleMarkMissed = async (instanceId: string) => {
    setMarkingMissedId(instanceId)
    try {
      await markMissed({
        instanceId: instanceId as Id<'choreInstances'>,
      })
    } finally {
      setMarkingMissedId(null)
    }
  }

  const handleUnmarkDone = async (instanceId: string, childId: string) => {
    const key = getParticipantKey(instanceId, childId)
    setUnmarking(key)
    try {
      await unmarkDone({
        instanceId: instanceId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
      })
    } finally {
      setUnmarking(null)
    }
  }

  const handleRateParticipant = async (
    instanceId: string,
    childId: string,
    quality: QualityRating,
    effortPercent?: number,
  ) => {
    const key = getParticipantKey(instanceId, childId)
    setRating(key)
    try {
      await rateParticipant({
        instanceId: instanceId as Id<'choreInstances'>,
        childId: childId as Id<'children'>,
        quality,
        effortPercent,
      })
      setCustomEffortChild(null)
    } finally {
      setRating(null)
    }
  }

  if (children === undefined || todayChores === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const canQuickAssign = (templates?.length ?? 0) > 0 && children.length > 0
  const activeChores = todayChores.filter(
    (chore): chore is NonNullable<(typeof todayChores)[number]> =>
      chore !== null && chore.status === 'pending',
  )
  const reviewCount = activeChores.filter((chore) =>
    chore.participants.some((participant) => participant.status === 'done'),
  ).length
  const rateAllChoreData =
    activeChores.find((chore) => chore._id === rateAllChore) ?? null
  const hasInvalidRateAllEffort = Boolean(
    rateAllChoreData?.isJoined && !validateEffortTotal(rateAllEfforts),
  )

  const initializeRateAll = (chore: (typeof activeChores)[number]) => {
    const participantIds = chore.participants.map(
      (participant) => participant.childId,
    )
    const qualities = Object.fromEntries(
      participantIds.map((childId) => [childId, 'good']),
    ) as Record<string, QualityRating>

    setRateAllQualities(qualities)
    setRateAllEfforts(initializeEqualEfforts(participantIds))
    setRateAllNotes('')
    setRateAllChore(chore._id)
  }

  const adjustRateAllEffort = (childId: string, newValue: number) => {
    setRateAllEfforts((prev) => redistributeEfforts(prev, childId, newValue))
  }

  const handleRateAll = async () => {
    if (!rateAllChoreData) return

    setIsSubmittingRatings(true)
    try {
      const ratings = Object.entries(rateAllQualities).map(
        ([childId, quality]) => ({
          childId: childId as Id<'children'>,
          quality,
          effortPercent: rateAllChoreData.isJoined
            ? (rateAllEfforts[childId] ?? 0)
            : undefined,
        }),
      )

      await rateAllParticipants({
        instanceId: rateAllChoreData._id as Id<'choreInstances'>,
        ratings,
        notes: rateAllNotes.trim() || undefined,
      })
      resetRateAllDialog()
    } finally {
      setIsSubmittingRatings(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of today's chores and balances
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canQuickAssign && (
            <Button variant="outline" onClick={() => setQuickAssignOpen(true)}>
              <Zap className="mr-2 h-4 w-4" />
              Quick Assign
            </Button>
          )}
        </div>
      </div>

      {/* Quick Assign Dialog */}
      <Dialog
        open={quickAssignOpen}
        onOpenChange={(open) => {
          if (!open) resetQuickAssign()
          setQuickAssignOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Assign Chore</DialogTitle>
            <DialogDescription>
              Assign a one-time chore for today
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Select Children */}
            <div className="space-y-2">
              <Label>Assign to</Label>
              <div className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <button
                    key={child._id}
                    type="button"
                    onClick={() => toggleChild(child._id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                      selectedChildren.includes(child._id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <span>{child.avatarEmoji}</span>
                    <span>{child.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Joined Toggle */}
            {selectedChildren.length > 1 && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="joined">Joined Chore</Label>
                  <p className="text-sm text-muted-foreground">
                    Children work together, reward is split
                  </p>
                </div>
                <Switch
                  id="joined"
                  checked={isJoined}
                  onCheckedChange={setIsJoined}
                />
              </div>
            )}

            {/* Select Template */}
            <div className="space-y-2">
              <Label>Chore</Label>
              <Select
                value={selectedTemplate}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a chore" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template._id} value={template._id}>
                      {template.icon} {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reward */}
            <div className="space-y-2">
              <Label htmlFor="reward">
                {isJoined ? 'Total Reward' : 'Reward'} ({currency})
              </Label>
              <Input
                id="reward"
                type="number"
                step="0.01"
                min="0"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickAssign}
              disabled={
                !selectedTemplate ||
                selectedChildren.length === 0 ||
                isAssigning
              }
            >
              {isAssigning ? 'Assigning...' : 'Assign Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Children Overview */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Children</h2>
          <Link to="/children">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          </Link>
        </div>

        {children.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No children yet"
            description="Add your first child to start tracking chores"
            action={
              <Link to="/children">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Child
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => {
              // Count pending chores for this child
              const pendingChores = todayChores.filter(
                (chore) =>
                  chore?.status !== 'missed' &&
                  chore?.participants.some(
                    (p) => p.childId === child._id && p.status === 'pending',
                  ),
              ).length

              return (
                <Link
                  key={child._id}
                  to="/children/$childId"
                  params={{ childId: child._id }}
                >
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-2xl">
                        {child.avatarEmoji}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{child.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Balance
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            <Money cents={child.balance} currency={currency} />
                          </p>
                        </div>
                        {pendingChores > 0 && (
                          <Badge variant="pending">
                            {pendingChores} pending
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Today's Chores */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Today's Chores</h2>
          {reviewCount > 0 && (
            <Badge variant="reviewing">{reviewCount} awaiting review</Badge>
          )}
        </div>

        {activeChores.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck />}
            title="No active chores"
            description="Schedule some chores to see them here"
            action={
              <Link to="/schedule">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Chore
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {activeChores.map((chore) => {
              const doneCount = chore.participants.filter(
                (p) => p.status === 'done',
              ).length
              const totalCount = chore.participants.length
              const isOverdue = chore.dueDate < today
              const isReviewing = doneCount > 0
              const rewardLabel = chore.isJoined
                ? 'pooled reward'
                : totalCount > 1
                  ? 'per kid'
                  : null

              return (
                <Card
                  key={chore._id}
                  className={isOverdue ? 'border-orange-300' : ''}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${
                          isOverdue ? 'bg-orange-100' : 'bg-gray-100'
                        }`}
                      >
                        {chore.template?.icon ?? '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {chore.template?.name ?? 'Unknown Chore'}
                          </p>
                          {chore.isJoined && (
                            <Badge variant="secondary">
                              <Users className="mr-1 h-3 w-3" />
                              Joined
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Overdue ({chore.dueDate})
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <Money
                            cents={chore.totalReward}
                            currency={currency}
                          />
                          {rewardLabel && ` · ${rewardLabel}`}
                          {totalCount > 1 &&
                            ` · ${doneCount}/${totalCount} done`}
                        </p>
                        {totalCount > 1 && (
                          <div className="mt-2">
                            <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="bg-green-500 transition-all"
                                style={{
                                  width: `${(doneCount / totalCount) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Badge variant={isReviewing ? 'reviewing' : 'pending'}>
                        {isReviewing ? 'In Review' : 'Pending'}
                      </Badge>
                    </div>

                    {isReviewing ? (
                      <div className="mt-4 space-y-3">
                        {totalCount > 1 &&
                          chore.participants.every(
                            (participant) => participant.status === 'done',
                          ) &&
                          !chore.participants.some(
                            (participant) => participant.quality,
                          ) && (
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

                        {chore.participants.map((participant) => {
                          const participantKey = getParticipantKey(
                            chore._id,
                            participant.childId,
                          )
                          const isMarking = marking === participantKey
                          const isUnmarking = unmarking === participantKey
                          const isRating = rating === participantKey
                          const alreadyRated = Boolean(participant.quality)
                          const isDone = participant.status === 'done'
                          const isCustomEffort =
                            customEffortChild?.choreId === chore._id &&
                            customEffortChild.childId === participant.childId
                          const baseReward = calculateBaseRewardForDisplay(
                            chore.totalReward,
                            totalCount,
                            chore.isJoined,
                            isCustomEffort ? customEffortValue : undefined,
                          )

                          return (
                            <div
                              key={participant.childId}
                              className={`rounded-lg border ${
                                alreadyRated
                                  ? 'border-green-200 bg-green-50'
                                  : ''
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-3 p-3">
                                <div className="flex flex-1 items-center gap-2">
                                  <span className="text-xl">
                                    {participant.child?.avatarEmoji}
                                  </span>
                                  <span className="font-medium">
                                    {participant.child?.name}
                                  </span>
                                  {isDone && !alreadyRated && (
                                    <Badge
                                      variant="reviewing"
                                      className="text-xs"
                                    >
                                      Ready
                                    </Badge>
                                  )}
                                  {participant.status === 'pending' && (
                                    <Badge
                                      variant="pending"
                                      className="text-xs"
                                    >
                                      Not done
                                    </Badge>
                                  )}
                                  {alreadyRated &&
                                    participant.effortPercent !== undefined &&
                                    chore.isJoined && (
                                      <span className="text-xs text-muted-foreground">
                                        ({participant.effortPercent.toFixed(0)}
                                        %)
                                      </span>
                                    )}
                                </div>

                                {alreadyRated ? (
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={participant.quality ?? 'default'}
                                    >
                                      {participant.quality === 'excellent' &&
                                        '⭐ '}
                                      {participant.quality}
                                    </Badge>
                                    <Money
                                      cents={participant.earnedReward ?? 0}
                                      currency={currency}
                                      showSign
                                      colorize
                                      className="text-sm font-medium"
                                    />
                                  </div>
                                ) : isDone ? (
                                  <div className="flex grow flex-wrap items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                      onClick={() =>
                                        handleUnmarkDone(
                                          chore._id,
                                          participant.childId,
                                        )
                                      }
                                      disabled={isUnmarking}
                                      title="Mark as not done"
                                    >
                                      {isUnmarking ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                      ) : (
                                        <Undo2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                    {chore.isJoined && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 w-8 p-0 ${isCustomEffort ? 'bg-purple-100' : ''}`}
                                        onClick={() => {
                                          if (isCustomEffort) {
                                            setCustomEffortChild(null)
                                          } else {
                                            setCustomEffortChild({
                                              choreId: chore._id,
                                              childId: participant.childId,
                                            })
                                            setCustomEffortValue(
                                              participant.effortPercent ??
                                                100 / totalCount,
                                            )
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
                                      className="h-8 px-2 border-gray-300 text-gray-600 hover:bg-gray-50"
                                      onClick={() =>
                                        handleRateParticipant(
                                          chore._id,
                                          participant.childId,
                                          'failed',
                                          isCustomEffort
                                            ? customEffortValue
                                            : undefined,
                                        )
                                      }
                                      disabled={isRating}
                                      title="Failed (0%)"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={() =>
                                        handleRateParticipant(
                                          chore._id,
                                          participant.childId,
                                          'bad',
                                          isCustomEffort
                                            ? customEffortValue
                                            : undefined,
                                        )
                                      }
                                      disabled={isRating}
                                    >
                                      <ThumbsDown className="h-3 w-3" />
                                      <span className="ml-1 text-xs">
                                        <Money
                                          cents={calculateDisplayedRewardForQuality(
                                            baseReward,
                                            'bad',
                                          )}
                                          currency={currency}
                                        />
                                      </span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                                      onClick={() =>
                                        handleRateParticipant(
                                          chore._id,
                                          participant.childId,
                                          'good',
                                          isCustomEffort
                                            ? customEffortValue
                                            : undefined,
                                        )
                                      }
                                      disabled={isRating}
                                    >
                                      <ThumbsUp className="h-3 w-3" />
                                      <span className="ml-1 text-xs">
                                        <Money
                                          cents={calculateDisplayedRewardForQuality(
                                            baseReward,
                                            'good',
                                          )}
                                          currency={currency}
                                        />
                                      </span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 border-amber-200 text-amber-600 hover:bg-amber-50"
                                      onClick={() =>
                                        handleRateParticipant(
                                          chore._id,
                                          participant.childId,
                                          'excellent',
                                          isCustomEffort
                                            ? customEffortValue
                                            : undefined,
                                        )
                                      }
                                      disabled={isRating}
                                    >
                                      <Star className="h-3 w-3" />
                                      <span className="ml-1 text-xs">
                                        <Money
                                          cents={calculateDisplayedRewardForQuality(
                                            baseReward,
                                            'excellent',
                                          )}
                                          currency={currency}
                                        />
                                      </span>
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 border-green-200 text-green-600 hover:bg-green-50"
                                    onClick={() =>
                                      handleMarkDone(
                                        chore._id,
                                        participant.childId,
                                      )
                                    }
                                    disabled={isMarking}
                                    title="Mark as done"
                                  >
                                    {isMarking ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                      <>
                                        <CheckCircle2 className="mr-1 h-4 w-4" />
                                        Mark Done
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>

                              {isCustomEffort && isDone && !alreadyRated && (
                                <div className="px-3 pb-3 pt-0">
                                  <div className="flex items-center gap-3 rounded-lg bg-purple-50 p-2">
                                    <span className="text-xs text-purple-700">
                                      Participation:
                                    </span>
                                    <Slider
                                      value={[customEffortValue]}
                                      min={0}
                                      max={200}
                                      step={5}
                                      onValueChange={([value]) =>
                                        setCustomEffortValue(value)
                                      }
                                      className="flex-1"
                                    />
                                    <span className="w-12 text-right text-sm font-medium text-purple-700">
                                      {customEffortValue}%
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chore.participants.map((p) => {
                          const key = getParticipantKey(chore._id, p.childId)
                          const isMarking = marking === key
                          const isDone = p.status === 'done'

                          return (
                            <Button
                              key={p.childId}
                              variant={isDone ? 'default' : 'outline'}
                              size="sm"
                              className={
                                isDone ? 'bg-green-600 hover:bg-green-700' : ''
                              }
                              disabled={isDone || isMarking}
                              onClick={() =>
                                handleMarkDone(chore._id, p.childId)
                              }
                            >
                              {isMarking ? (
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : isDone ? (
                                <Check className="mr-1 h-4 w-4" />
                              ) : null}
                              {p.child?.avatarEmoji} {p.child?.name}
                              {!isDone && ' - Mark Done'}
                            </Button>
                          )
                        })}
                        {doneCount === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                            onClick={() => handleMarkMissed(chore._id)}
                            disabled={markingMissedId === chore._id}
                          >
                            {markingMissedId === chore._id ? (
                              <div className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Ban className="mr-1 h-4 w-4" />
                            )}
                            Mark as Missed
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Dialog
        open={!!rateAllChore}
        onOpenChange={(open) => {
          if (!open) resetRateAllDialog()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate All Participants</DialogTitle>
            <DialogDescription>
              Set individual ratings and participation percentages for each
              child
            </DialogDescription>
          </DialogHeader>

          {rateAllChoreData && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
                  {rateAllChoreData.template?.icon ?? '📋'}
                </div>
                <div>
                  <p className="font-semibold">
                    {rateAllChoreData.template?.name ?? 'Unknown Chore'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total reward:{' '}
                    <Money
                      cents={rateAllChoreData.totalReward}
                      currency={currency}
                    />
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Rate Each Participant</Label>
                {rateAllChoreData.participants.map((participant) => {
                  const quality =
                    rateAllQualities[participant.childId] ?? 'good'
                  const effort = rateAllEfforts[participant.childId] ?? 0
                  const earnedReward = calculateRateAllEarnedReward(
                    rateAllChoreData.totalReward,
                    effort,
                    quality,
                    rateAllChoreData.isJoined,
                  )

                  return (
                    <div
                      key={participant.childId}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          {participant.child?.avatarEmoji}{' '}
                          {participant.child?.name}
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          <Money cents={earnedReward} currency={currency} />
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'failed' ? 'border-gray-500 bg-gray-100 text-gray-700' : 'border-gray-300 text-gray-500'}`}
                          onClick={() =>
                            setRateAllQualities((prev) => ({
                              ...prev,
                              [participant.childId]: 'failed',
                            }))
                          }
                        >
                          <X className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Fail</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'bad' ? 'border-red-500 bg-red-50 text-red-700' : 'border-red-200 text-red-600'}`}
                          onClick={() =>
                            setRateAllQualities((prev) => ({
                              ...prev,
                              [participant.childId]: 'bad',
                            }))
                          }
                        >
                          <ThumbsDown className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Bad</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'good' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-200 text-blue-600'}`}
                          onClick={() =>
                            setRateAllQualities((prev) => ({
                              ...prev,
                              [participant.childId]: 'good',
                            }))
                          }
                        >
                          <ThumbsUp className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Good</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 ${quality === 'excellent' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-amber-200 text-amber-600'}`}
                          onClick={() =>
                            setRateAllQualities((prev) => ({
                              ...prev,
                              [participant.childId]: 'excellent',
                            }))
                          }
                        >
                          <Star className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Excellent</span>
                        </Button>
                      </div>

                      {rateAllChoreData.isJoined && (
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs text-muted-foreground">
                            Participation:
                          </span>
                          <Slider
                            value={[effort]}
                            min={0}
                            max={100}
                            step={5}
                            onValueChange={([value]) =>
                              adjustRateAllEffort(participant.childId, value)
                            }
                            className="flex-1"
                          />
                          <span className="w-12 text-right text-sm font-medium">
                            {effort.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {hasInvalidRateAllEffort && (
                  <p className="text-sm text-destructive">
                    Participation must total 100% (currently{' '}
                    {Object.values(rateAllEfforts)
                      .reduce((sum, value) => sum + value, 0)
                      .toFixed(0)}
                    %)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rateAllNotes">Notes (optional)</Label>
                <Input
                  id="rateAllNotes"
                  value={rateAllNotes}
                  onChange={(event) => setRateAllNotes(event.target.value)}
                  placeholder="Any comments about this chore"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetRateAllDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleRateAll}
              disabled={isSubmittingRatings || hasInvalidRateAllEffort}
            >
              {isSubmittingRatings ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              Submit Ratings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
