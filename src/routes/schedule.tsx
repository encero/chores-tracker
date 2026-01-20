import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Money } from '@/components/ui/money'
import { Calendar, Plus, Trash2, Pause, Play, Users, Pencil, Sparkles } from 'lucide-react'

export const Route = createFileRoute('/schedule')({
  component: SchedulePage,
})

function SchedulePage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <ScheduleContent />
      </ParentLayout>
    </AuthGuard>
  )
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function ScheduleContent() {
  const schedules = useQuery(api.scheduledChores.list, {})
  const templates = useQuery(api.choreTemplates.list)
  const children = useQuery(api.children.list)
  const settings = useQuery(api.settings.get)

  const createSchedule = useMutation(api.scheduledChores.create)
  const updateSchedule = useMutation(api.scheduledChores.update)
  const removeSchedule = useMutation(api.scheduledChores.remove)
  const toggleActive = useMutation(api.scheduledChores.toggleActive)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [reward, setReward] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [isOptional, setIsOptional] = useState(false)
  const [maxPickupsPerPeriod, setMaxPickupsPerPeriod] = useState('')
  const [scheduleType, setScheduleType] = useState<'once' | 'daily' | 'weekly' | 'custom'>('daily')
  const [scheduleDays, setScheduleDays] = useState<number[]>([])
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currency = settings?.currency ?? '$'

  const resetForm = () => {
    setSelectedChildren([])
    setSelectedTemplate('')
    setReward('')
    setIsJoined(false)
    setIsOptional(false)
    setMaxPickupsPerPeriod('')
    setScheduleType('daily')
    setScheduleDays([])
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates?.find((t) => t._id === templateId)
    if (template) {
      setReward((template.defaultReward / 100).toFixed(2))
    }
  }

  const toggleChild = (childId: string) => {
    setSelectedChildren((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId]
    )
  }

  const toggleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleAdd = async () => {
    if (!selectedTemplate || (!isOptional && selectedChildren.length === 0)) return

    setIsSubmitting(true)
    try {
      await createSchedule({
        childIds: isOptional ? [] : selectedChildren as Id<'children'>[],
        choreTemplateId: selectedTemplate as Id<'choreTemplates'>,
        reward: Math.round(parseFloat(reward || '0') * 100),
        isJoined: !isOptional && isJoined && selectedChildren.length > 1,
        isOptional,
        maxPickupsPerPeriod: isOptional && maxPickupsPerPeriod ? parseInt(maxPickupsPerPeriod) : undefined,
        scheduleType,
        scheduleDays: scheduleType === 'custom' ? scheduleDays : undefined,
        startDate,
        endDate: endDate || undefined,
      })
      resetForm()
      setIsAddOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsSubmitting(true)
    try {
      await removeSchedule({ id: id as Id<'scheduledChores'> })
      setDeletingId(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (schedule: NonNullable<typeof schedules>[number]) => {
    setEditingId(schedule._id)
    setSelectedChildren(schedule.childIds)
    setSelectedTemplate(schedule.choreTemplateId)
    setReward((schedule.reward / 100).toFixed(2))
    setIsJoined(schedule.isJoined)
    setIsOptional(schedule.isOptional ?? false)
    setMaxPickupsPerPeriod(schedule.maxPickupsPerPeriod?.toString() ?? '')
    setScheduleType(schedule.scheduleType)
    setScheduleDays(schedule.scheduleDays ?? [])
    setStartDate(schedule.startDate)
    setEndDate(schedule.endDate ?? '')
  }

  const handleUpdate = async () => {
    if (!editingId || (!isOptional && selectedChildren.length === 0)) return

    setIsSubmitting(true)
    try {
      await updateSchedule({
        id: editingId as Id<'scheduledChores'>,
        childIds: isOptional ? [] : selectedChildren as Id<'children'>[],
        reward: Math.round(parseFloat(reward || '0') * 100),
        isJoined: !isOptional && isJoined && selectedChildren.length > 1,
        isOptional,
        maxPickupsPerPeriod: isOptional && maxPickupsPerPeriod ? parseInt(maxPickupsPerPeriod) : undefined,
        scheduleType,
        scheduleDays: scheduleType === 'custom' ? scheduleDays : undefined,
        endDate: endDate || undefined,
      })
      resetForm()
      setEditingId(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (id: string) => {
    await toggleActive({ id: id as Id<'scheduledChores'> })
  }

  if (schedules === undefined || templates === undefined || children === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Manage recurring chore assignments
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          setIsAddOpen(open)
        }}>
          <DialogTrigger asChild>
            <Button disabled={templates.length === 0 || children.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Chore
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Chore</DialogTitle>
              <DialogDescription>
                Schedule a chore for one or more children
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Optional Chore Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3 bg-amber-50/50">
                <div className="space-y-0.5">
                  <Label htmlFor="optional" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Optional Chore
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Any child can pick up this chore for extra earnings
                  </p>
                </div>
                <Switch
                  id="optional"
                  checked={isOptional}
                  onCheckedChange={(checked) => {
                    setIsOptional(checked)
                    if (checked) {
                      setIsJoined(false)
                      setSelectedChildren([])
                    }
                  }}
                />
              </div>

              {/* Max Pickups (for optional chores) */}
              {isOptional && (
                <div className="space-y-2">
                  <Label htmlFor="maxPickups">Max Pickups Per Period (optional)</Label>
                  <Input
                    id="maxPickups"
                    type="number"
                    min="1"
                    value={maxPickupsPerPeriod}
                    onChange={(e) => setMaxPickupsPerPeriod(e.target.value)}
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for unlimited. Period is based on frequency (daily = per day, weekly = per week).
                  </p>
                </div>
              )}

              {/* Select Children */}
              {!isOptional && (
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
              )}

              {/* Joined Chore Toggle */}
              {!isOptional && selectedChildren.length > 1 && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="joined">Joined Chore</Label>
                    <p className="text-sm text-muted-foreground">
                      Children work together, reward is split by effort
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
                    {templates.map((template) => (
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
                {isJoined && (
                  <p className="text-xs text-muted-foreground">
                    This total will be split among participants based on effort
                  </p>
                )}
              </div>

              {/* Schedule Type */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as typeof scheduleType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One Time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Days */}
              {scheduleType === 'custom' && (
                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          scheduleDays.includes(day.value)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              {scheduleType !== 'once' && (
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={
                  !selectedTemplate ||
                  (!isOptional && selectedChildren.length === 0) ||
                  (scheduleType === 'custom' && scheduleDays.length === 0) ||
                  isSubmitting
                }
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 || children.length === 0 ? (
        <EmptyState
          icon={<Calendar />}
          title={templates.length === 0 ? "No chore templates" : "No children"}
          description={
            templates.length === 0
              ? "Create chore templates first before scheduling"
              : "Add children before scheduling chores"
          }
        />
      ) : schedules.filter((s) => s.scheduleType !== 'once').length === 0 ? (
        <EmptyState
          icon={<Calendar />}
          title="No scheduled chores"
          description="Assign chores to children to see them here"
          action={
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Chore
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {schedules.filter((schedule) => schedule.scheduleType !== 'once').map((schedule) => (
            <Card key={schedule._id} className={!schedule.isActive ? 'opacity-60' : ''}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                    {schedule.template?.icon ?? '📋'}
                  </div>
                  <div className="flex-1 min-w-0 sm:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {schedule.template?.name ?? 'Unknown Chore'}
                      </p>
                      {schedule.isOptional && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Optional
                        </Badge>
                      )}
                      {schedule.isJoined && (
                        <Badge variant="secondary">
                          <Users className="mr-1 h-3 w-3" />
                          Joined
                        </Badge>
                      )}
                      {!schedule.isActive && (
                        <Badge variant="outline">Paused</Badge>
                      )}
                    </div>
                    <p className="font-semibold text-green-600">
                      <Money cents={schedule.reward} currency={currency} />
                      {schedule.isJoined && <span className="text-xs text-muted-foreground ml-1">total</span>}
                    </p>
                  </div>
                </div>
                <div className="flex-1 min-w-0 hidden sm:block">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {schedule.template?.name ?? 'Unknown Chore'}
                    </p>
                    {schedule.isOptional && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Optional
                      </Badge>
                    )}
                    {schedule.isJoined && (
                      <Badge variant="secondary">
                        <Users className="mr-1 h-3 w-3" />
                        Joined
                      </Badge>
                    )}
                    {!schedule.isActive && (
                      <Badge variant="outline">Paused</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {schedule.isOptional ? (
                      <span className="flex items-center gap-1">
                        Anyone can pick up
                        {schedule.maxPickupsPerPeriod && (
                          <span> (max {schedule.maxPickupsPerPeriod}/period)</span>
                        )}
                      </span>
                    ) : (
                      schedule.children?.map((child) => (
                        <span key={child?._id} className="flex items-center gap-1">
                          {child?.avatarEmoji} {child?.name}
                        </span>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {schedule.scheduleType === 'once' && `One time: ${schedule.startDate}`}
                    {schedule.scheduleType === 'daily' && 'Daily'}
                    {schedule.scheduleType === 'weekly' && 'Weekly'}
                    {schedule.scheduleType === 'custom' &&
                      `${schedule.scheduleDays?.map((d) => DAYS_OF_WEEK[d].label).join(', ')}`}
                    {schedule.endDate && ` until ${schedule.endDate}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:hidden">
                  {schedule.isOptional ? (
                    <span className="flex items-center gap-1">
                      Anyone can pick up
                      {schedule.maxPickupsPerPeriod && (
                        <span> (max {schedule.maxPickupsPerPeriod}/period)</span>
                      )}
                    </span>
                  ) : (
                    schedule.children?.map((child) => (
                      <span key={child?._id} className="flex items-center gap-1">
                        {child?.avatarEmoji} {child?.name}
                      </span>
                    ))
                  )}
                  <span className="text-xs">
                    {schedule.scheduleType === 'once' && `One time: ${schedule.startDate}`}
                    {schedule.scheduleType === 'daily' && 'Daily'}
                    {schedule.scheduleType === 'weekly' && 'Weekly'}
                    {schedule.scheduleType === 'custom' &&
                      `${schedule.scheduleDays?.map((d) => DAYS_OF_WEEK[d].label).join(', ')}`}
                    {schedule.endDate && ` until ${schedule.endDate}`}
                  </span>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <p className="font-semibold text-green-600">
                    <Money cents={schedule.reward} currency={currency} />
                  </p>
                  {schedule.isJoined && (
                    <p className="text-xs text-muted-foreground">total</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 self-end sm:self-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(schedule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(schedule._id)}
                  >
                    {schedule.isActive ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Dialog
                    open={deletingId === schedule._id}
                    onOpenChange={(open) => !open && setDeletingId(null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(schedule._id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Schedule</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete this scheduled chore? All
                          related instances will also be deleted.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDelete(schedule._id)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Deleting...' : 'Delete'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Schedule Dialog */}
      <Dialog
        open={!!editingId}
        onOpenChange={(open) => {
          if (!open) {
            resetForm()
            setEditingId(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update this scheduled chore
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Template (read-only) */}
            <div className="space-y-2">
              <Label>Chore</Label>
              <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/50">
                {templates?.find((t) => t._id === selectedTemplate)?.icon ?? '📋'}
                <span>{templates?.find((t) => t._id === selectedTemplate)?.name ?? 'Unknown'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Chore type cannot be changed. Delete and recreate if needed.
              </p>
            </div>

            {/* Optional Chore Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-amber-50/50">
              <div className="space-y-0.5">
                <Label htmlFor="edit-optional" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Optional Chore
                </Label>
                <p className="text-sm text-muted-foreground">
                  Any child can pick up this chore for extra earnings
                </p>
              </div>
              <Switch
                id="edit-optional"
                checked={isOptional}
                onCheckedChange={(checked) => {
                  setIsOptional(checked)
                  if (checked) {
                    setIsJoined(false)
                    setSelectedChildren([])
                  }
                }}
              />
            </div>

            {/* Max Pickups (for optional chores) */}
            {isOptional && (
              <div className="space-y-2">
                <Label htmlFor="edit-maxPickups">Max Pickups Per Period (optional)</Label>
                <Input
                  id="edit-maxPickups"
                  type="number"
                  min="1"
                  value={maxPickupsPerPeriod}
                  onChange={(e) => setMaxPickupsPerPeriod(e.target.value)}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited. Period is based on frequency (daily = per day, weekly = per week).
                </p>
              </div>
            )}

            {/* Select Children */}
            {!isOptional && (
              <div className="space-y-2">
                <Label>Assign to</Label>
                <div className="flex flex-wrap gap-2">
                  {children?.map((child) => (
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
            )}

            {/* Joined Chore Toggle */}
            {!isOptional && selectedChildren.length > 1 && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-joined">Joined Chore</Label>
                  <p className="text-sm text-muted-foreground">
                    Children work together, reward is split by effort
                  </p>
                </div>
                <Switch
                  id="edit-joined"
                  checked={isJoined}
                  onCheckedChange={setIsJoined}
                />
              </div>
            )}

            {/* Reward */}
            <div className="space-y-2">
              <Label htmlFor="edit-reward">
                {isJoined ? 'Total Reward' : 'Reward'} ({currency})
              </Label>
              <Input
                id="edit-reward"
                type="number"
                step="0.01"
                min="0"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Schedule Type */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={scheduleType}
                onValueChange={(v) => setScheduleType(v as typeof scheduleType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One Time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Days */}
            {scheduleType === 'custom' && (
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        scheduleDays.includes(day.value)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* End Date */}
            {scheduleType !== 'once' && (
              <div className="space-y-2">
                <Label htmlFor="edit-endDate">End Date (optional)</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                setEditingId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={
                (!isOptional && selectedChildren.length === 0) ||
                (scheduleType === 'custom' && scheduleDays.length === 0) ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
