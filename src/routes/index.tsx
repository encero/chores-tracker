import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/currency'
import { Users, ClipboardCheck, Plus, Check } from 'lucide-react'

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
  const forReview = useQuery(api.choreInstances.getForReview)
  const settings = useQuery(api.settings.get)

  const markDone = useMutation(api.choreInstances.markDone)
  const [marking, setMarking] = useState<string | null>(null)

  const currency = settings?.currency ?? '$'

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

  if (children === undefined || todayChores === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const reviewCount = forReview?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of today's chores and balances
          </p>
        </div>
        {reviewCount > 0 && (
          <Link to="/review">
            <Button>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Review ({reviewCount})
            </Button>
          </Link>
        )}
      </div>

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
              const pendingChores = todayChores?.filter((chore) =>
                chore?.participants?.some(
                  (p) => p.childId === child._id && p.status === 'pending'
                )
              ).length ?? 0

              return (
                <Link key={child._id} to={`/children/${child._id}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-2xl">
                        {child.avatarEmoji}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{child.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Code: {child.accessCode}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(child.balance, currency)}
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

        {!todayChores || todayChores.length === 0 ? (
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
            {todayChores.map((chore) => {
              if (!chore) return null

              const doneCount = chore.participants?.filter(
                (p) => p.status === 'done'
              ).length ?? 0
              const totalCount = chore.participants?.length ?? 0
              const allDone = doneCount === totalCount

              return (
                <Card key={chore._id}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">
                        {chore.template?.icon ?? '📋'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {chore.template?.name ?? 'Unknown Chore'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(chore.totalReward, currency)}
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
                        {chore.participants?.map((p) => {
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
