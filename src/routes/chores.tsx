import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ListTodo, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { PageHeader } from '@/components/page/PageHeader'
import { LoadMoreButton } from '@/components/page/LoadMoreButton'
import { FormField } from '@/components/forms/FormField'
import { CHORE_ICONS, EmojiPicker } from '@/components/forms/EmojiPicker'
import { RewardInput } from '@/components/forms/RewardInput'
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog'

const ITEMS_PER_PAGE = 12

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

function ChoresContent() {
  const [limit, setLimit] = useState(ITEMS_PER_PAGE)
  const templatesResult = useQuery(api.choreTemplates.list, { limit })
  const settings = useQuery(api.settings.get)
  const createTemplate = useMutation(api.choreTemplates.create)
  const updateTemplate = useMutation(api.choreTemplates.update)
  const removeTemplate = useMutation(api.choreTemplates.remove)

  const templates = templatesResult?.items
  const hasMore = templatesResult?.hasMore ?? false

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
        id: id as never,
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
      await removeTemplate({ id: id as never })
      setDeletingId(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      setDeleteError(message)
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

  if (templatesResult === undefined) {
    return <LoadingSpinner className="py-12" />
  }

  const deletingTemplate = templates?.find((t) => t._id === deletingId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chore Templates"
        description="Manage reusable chore definitions"
        action={
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
                <FormField
                  label="Name"
                  id="name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g., Make bed"
                />
                <FormField
                  label="Description (optional)"
                  id="description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Instructions for this chore"
                />
                <RewardInput
                  value={reward}
                  onChange={setReward}
                  currency={currency}
                />
                <EmojiPicker
                  label="Icon"
                  options={CHORE_ICONS}
                  value={icon}
                  onChange={setIcon}
                />
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
        }
      />

      {!templates || templates.length === 0 ? (
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
        <div className="space-y-4">
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
                            <FormField
                              label="Name"
                              id="edit-name"
                              value={name}
                              onChange={setName}
                            />
                            <FormField
                              label="Description"
                              id="edit-description"
                              value={description}
                              onChange={setDescription}
                            />
                            <div className="space-y-2">
                              <Label>Default Reward ({currency})</Label>
                              <RewardInput
                                value={reward}
                                onChange={setReward}
                                currency={currency}
                              />
                            </div>
                            <EmojiPicker
                              label="Icon"
                              options={CHORE_ICONS}
                              value={icon}
                              onChange={setIcon}
                            />
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteError(null)
                          setDeletingId(template._id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <LoadMoreButton
            hasMore={hasMore}
            onLoadMore={() => setLimit((prev) => prev + ITEMS_PER_PAGE)}
          />
        </div>
      )}

      <ConfirmDeleteDialog
        open={deletingId !== null}
        onClose={() => {
          setDeletingId(null)
          setDeleteError(null)
        }}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        itemName={deletingTemplate?.name ?? ''}
        itemType="Template"
        isLoading={isSubmitting}
        error={deleteError}
      />
    </div>
  )
}
