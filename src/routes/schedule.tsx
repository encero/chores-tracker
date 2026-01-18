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
import { formatCurrency } from '@/lib/currency'
import { Calendar, Plus, Trash2, Pause, Play, Users } from 'lucide-react'

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
  const removeSchedule = useMutation(api.scheduledChores.remove)
  const toggleActive = useMutation(api.scheduledChores.toggleActive)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [reward, setReward] = useState('')
  const [isJoined, setIsJoined] = useState(false)
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
    if (!selectedTemplate || selectedChildren.length === 0) return

    setIsSubmitting(true)
    try {
      await createSchedule({
        childIds: selectedChildren as Id<'children'>[],
        choreTemplateId: selectedTemplate as Id<'choreTemplates'>,
        reward: Math.round(parseFloat(reward || '0') * 100),
        isJoined: isJoined && selectedChildren.length > 1,
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

              {/* Joined Chore Toggle */}
              {selectedChildren.length > 1 && (
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
                  <div className="flex gap-1">
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
                  selectedChildren.length === 0 ||
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
      ) : schedules.length === 0 ? (
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
          {schedules.map((schedule) => (
            <Card key={schedule._id} className={!schedule.isActive ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                  {schedule.template?.icon ?? '📋'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">
                      {schedule.template?.name ?? 'Unknown Chore'}
                    </p>
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {schedule.children?.map((child) => (
                      <span key={child?._id} className="flex items-center gap-1">
                        {child?.avatarEmoji} {child?.name}
                      </span>
                    ))}
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
                <div className="text-right">
                  <p className="font-semibold text-green-600">
                    {formatCurrency(schedule.reward, currency)}
                  </p>
                  {schedule.isJoined && (
                    <p className="text-xs text-muted-foreground">total</p>
                  )}
                </div>
                <div className="flex gap-1">
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
    </div>
  )
}
