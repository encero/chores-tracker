import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { AlertCircle, Ban, Check, ClipboardCheck, Plus, Users, Zap } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
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
  const forReviewResult = useQuery(api.choreInstances.getForReview, { limit: 100 })
  const templatesResult = useQuery(api.choreTemplates.list, {})
  const settings = useQuery(api.settings.get)

  const templates = templatesResult?.items

  const markDone = useMutation(api.choreInstances.markDone)
  const markMissed = useMutation(api.choreInstances.markMissed)
  const createSchedule = useMutation(api.scheduledChores.create)

  const [marking, setMarking] = useState<string | null>(null)
  const [markingMissedId, setMarkingMissedId] = useState<string | null>(null)
  const [quickAssignOpen, setQuickAssignOpen] = useState(false)
  const [selectedChildren, setSelectedChildren] = useState<Array<string>>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [reward, setReward] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currency = settings?.currency ?? '$'
  const today = new Date().toISOString().split('T')[0]

  const resetQuickAssign = () => {
    setSelectedChildren([])
    setSelectedTemplate('')
    setReward('')
    setIsJoined(false)
  }

  const toggleChild = (childId: string) => {
    setSelectedChildren((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId]
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

    setIsSubmitting(true)
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
      setIsSubmitting(false)
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

  if (children === undefined || todayChores === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const reviewCount = forReviewResult?.totalCount ?? 0
  const canQuickAssign = (templates?.length ?? 0) > 0 && children.length > 0

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
          {reviewCount > 0 && (
            <Link to="/review">
              <Button>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Review ({reviewCount})
              </Button>
            </Link>
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
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
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
                isSubmitting
              }
            >
              {isSubmitting ? 'Assigning...' : 'Assign Now'}
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
              const pendingChores = todayChores.filter((chore) =>
                chore.status !== 'missed' && chore.participants.some(
                  (p) => p.childId === child._id && p.status === 'pending'
                )
              ).length

              return (
                <Link key={child._id} to="/children/$childId" params={{ childId: child._id }}>
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
                          <p className="text-sm text-muted-foreground">Balance</p>
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
        <h2 className="mb-4 text-xl font-semibold">Today's Chores</h2>

        {todayChores.filter(c => c.status !== 'missed').length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck />}
            title="No chores for today"
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
            {todayChores.filter(c => c.status !== 'missed').map((chore) => {

              const doneCount = chore.participants.filter(
                (p) => p.status === 'done'
              ).length
              const totalCount = chore.participants.length
              const isOverdue = chore.dueDate < today

              return (
                <Card key={chore._id} className={isOverdue && chore.status === 'pending' ? 'border-orange-300' : ''}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${
                        isOverdue && chore.status === 'pending' ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        {chore.template?.icon ?? '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {chore.template?.name ?? 'Unknown Chore'}
                          </p>
                          {isOverdue && chore.status === 'pending' && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Overdue ({chore.dueDate})
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <Money cents={chore.totalReward} currency={currency} />
                          {chore.isJoined && ` total · ${doneCount}/${totalCount} done`}
                        </p>
                      </div>
                      <Badge
                        variant={
                          chore.status === 'completed'
                            ? 'completed'
                            : chore.status === 'missed'
                              ? 'missed'
                              : doneCount > 0
                                ? 'reviewing'
                                : 'pending'
                        }
                      >
                        {chore.status === 'completed'
                          ? 'Done'
                          : chore.status === 'missed'
                            ? 'Missed'
                            : doneCount > 0
                              ? 'In Review'
                              : 'Pending'}
                      </Badge>
                    </div>

                    {/* Participant list with mark done buttons */}
                    {chore.status === 'pending' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chore.participants.map((p) => {
                          const key = `${chore._id}-${p.childId}`
                          const isMarking = marking === key
                          const isDone = p.status === 'done'

                          return (
                            <Button
                              key={p.childId}
                              variant={isDone ? 'default' : 'outline'}
                              size="sm"
                              className={isDone ? 'bg-green-600 hover:bg-green-700' : ''}
                              disabled={isDone || isMarking}
                              onClick={() => handleMarkDone(chore._id, p.childId)}
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
                        </Button>)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
