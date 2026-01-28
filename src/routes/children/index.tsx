import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export const Route = createFileRoute('/children/')({
  component: ChildrenPage,
})

function ChildrenPage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <ChildrenContent />
      </ParentLayout>
    </AuthGuard>
  )
}

const EMOJI_OPTIONS = ['👦', '👧', '🧒', '👶', '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯']

function ChildrenContent() {
  const children = useQuery(api.children.list)
  const settings = useQuery(api.settings.get)
  const createChild = useMutation(api.children.create)
  const updateChild = useMutation(api.children.update)
  const removeChild = useMutation(api.children.remove)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingChild, setEditingChild] = useState<string | null>(null)
  const [deletingChild, setDeletingChild] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('👦')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currency = settings?.currency ?? '$'

  const handleAdd = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await createChild({ name: name.trim(), avatarEmoji: emoji })
      setName('')
      setEmoji('👦')
      setIsAddOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (childId: string) => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await updateChild({ id: childId as any, name: name.trim(), avatarEmoji: emoji })
      setEditingChild(null)
      setName('')
      setEmoji('👦')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (childId: string) => {
    setIsSubmitting(true)
    try {
      await removeChild({ id: childId as any })
      setDeletingChild(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (child: NonNullable<typeof children>[number]) => {
    setName(child.name)
    setEmoji(child.avatarEmoji)
    setEditingChild(child._id)
  }

  if (children === undefined) {
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
          <h1 className="text-3xl font-bold">Children</h1>
          <p className="text-muted-foreground">Manage your children</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Child</DialogTitle>
              <DialogDescription>
                Add a new child to track their chores
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter child's name"
                />
              </div>
              <div className="space-y-2">
                <Label>Avatar</Label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors ${
                        emoji === e
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {e}
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
                {isSubmitting ? 'Adding...' : 'Add Child'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {children.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No children yet"
          description="Add your first child to start tracking chores"
          action={
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <Card key={child._id}>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-3xl">
                  {child.avatarEmoji}
                </div>
                <div className="flex-1">
                  <CardTitle>{child.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    <Money cents={child.balance} currency={currency} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to="/children/$childId" params={{ childId: child._id }} className="flex-1">
                    <Button variant="outline" className="w-full">
                      View Details
                    </Button>
                  </Link>
                  <Dialog
                    open={editingChild === child._id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditingChild(null)
                        setName('')
                        setEmoji('👦')
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(child)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Child</DialogTitle>
                        <DialogDescription>
                          Update child's information
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="editName">Name</Label>
                          <Input
                            id="editName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Avatar</Label>
                          <div className="flex flex-wrap gap-2">
                            {EMOJI_OPTIONS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => setEmoji(e)}
                                className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors ${
                                  emoji === e
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setEditingChild(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleEdit(child._id)}
                          disabled={!name.trim() || isSubmitting}
                        >
                          {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog
                    open={deletingChild === child._id}
                    onOpenChange={(open) => !open && setDeletingChild(null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingChild(child._id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Child</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete {child.name}? This action
                          cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setDeletingChild(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDelete(child._id)}
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
