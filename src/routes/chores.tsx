import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ListTodo, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Money } from '@/components/ui/money'

export const Route = createFileRoute('/chores')({
  component: ChoresPage,
})

function ChoresPage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <ChoresContent />
      </ParentLayout>
    </AuthGuard>
  )
}

const CHORE_ICONS = ['🛏️', '🧹', '🍽️', '🗑️', '🐕', '📚', '🧺', '🚿', '🌱', '🚗', '✏️', '🧼']

function ChoresContent() {
  const templates = useQuery(api.choreTemplates.list)
  const settings = useQuery(api.settings.get)
  const createTemplate = useMutation(api.choreTemplates.create)
  const updateTemplate = useMutation(api.choreTemplates.update)
  const removeTemplate = useMutation(api.choreTemplates.remove)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [reward, setReward] = useState('')
  const [icon, setIcon] = useState('🛏️')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const currency = settings?.currency ?? '$'

  const resetForm = () => {
    setName('')
    setDescription('')
    setReward('')
    setIcon('🛏️')
  }

  const handleAdd = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        defaultReward: Math.round(parseFloat(reward || '0') * 100),
        icon,
      })
      resetForm()
      setIsAddOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (id: string) => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await updateTemplate({
        id: id as any,
        name: name.trim(),
        description: description.trim() || undefined,
        defaultReward: Math.round(parseFloat(reward || '0') * 100),
        icon,
      })
      setEditingId(null)
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsSubmitting(true)
    setDeleteError(null)
    try {
      await removeTemplate({ id: id as any })
      setDeletingId(null)
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (template: NonNullable<typeof templates>[number]) => {
    setName(template.name)
    setDescription(template.description ?? '')
    setReward((template.defaultReward / 100).toFixed(2))
    setIcon(template.icon)
    setEditingId(template._id)
  }

  if (templates === undefined) {
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
          <h1 className="text-3xl font-bold">Chore Templates</h1>
          <p className="text-muted-foreground">
            Manage reusable chore definitions
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          setIsAddOpen(open)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Chore Template</DialogTitle>
              <DialogDescription>
                Create a reusable chore definition
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Make bed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instructions for this chore"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward">Default Reward ({currency})</Label>
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
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {CHORE_ICONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIcon(i)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors ${
                        icon === i
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!name.trim() || isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<ListTodo />}
          title="No chore templates yet"
          description="Create templates to quickly schedule chores"
          action={
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template._id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                    {template.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <p className="mt-1 font-medium text-green-600">
                      <Money cents={template.defaultReward} currency={currency} />
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Dialog
                      open={editingId === template._id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingId(null)
                          resetForm()
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Default Reward ({currency})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={reward}
                              onChange={(e) => setReward(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Icon</Label>
                            <div className="flex flex-wrap gap-2">
                              {CHORE_ICONS.map((i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setIcon(i)}
                                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors ${
                                    icon === i
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                >
                                  {i}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleEdit(template._id)}
                            disabled={!name.trim() || isSubmitting}
                          >
                            {isSubmitting ? 'Saving...' : 'Save'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog
                      open={deletingId === template._id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setDeletingId(null)
                          setDeleteError(null)
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(template._id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Template</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete "{template.name}"?
                          </DialogDescription>
                        </DialogHeader>
                        {deleteError && (
                          <p className="text-sm text-destructive">{deleteError}</p>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeletingId(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(template._id)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Deleting...' : 'Delete'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
