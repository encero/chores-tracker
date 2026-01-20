import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { Money } from '@/components/ui/money'
import { ArrowLeft, Wallet, RefreshCw, ClipboardCheck, History, PenLine, Plus, Minus, Settings2 } from 'lucide-react'

export const Route = createFileRoute('/children/$childId')({
  component: ChildDetailPage,
})

function ChildDetailPage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <ChildDetailContent />
      </ParentLayout>
    </AuthGuard>
  )
}

function ChildDetailContent() {
  const { childId } = Route.useParams()
  const navigate = useNavigate()

  const child = useQuery(api.children.get, { id: childId as Id<'children'> })
  const settings = useQuery(api.settings.get)
  const withdrawals = useQuery(api.withdrawals.list, {
    childId: childId as Id<'children'>,
    limit: 20,
  })
  const chores = useQuery(api.choreInstances.getForChild, {
    childId: childId as Id<'children'>,
  })

  const createWithdrawal = useMutation(api.withdrawals.create)
  const adjustBalance = useMutation(api.children.adjustBalance)
  const regenerateCode = useMutation(api.children.regenerateAccessCode)

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawNote, setWithdrawNote] = useState('')
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove' | 'set'>('add')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currency = settings?.currency ?? '$'

  if (child === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (child === null) {
    return (
      <div className="space-y-4">
        <Link to="/children">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Children
          </Button>
        </Link>
        <EmptyState
          title="Child not found"
          description="This child may have been deleted"
        />
      </div>
    )
  }

  const handleWithdraw = async () => {
    const amount = Math.round(parseFloat(withdrawAmount) * 100)
    if (isNaN(amount) || amount <= 0) return

    setIsSubmitting(true)
    try {
      await createWithdrawal({
        childId: child._id,
        amount,
        note: withdrawNote.trim() || undefined,
      })
      setIsWithdrawOpen(false)
      setWithdrawAmount('')
      setWithdrawNote('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegenerateCode = async () => {
    if (confirm('Are you sure you want to regenerate the access code? The old code will stop working.')) {
      await regenerateCode({ id: child._id })
    }
  }

  const handleAdjust = async () => {
    const amount = Math.round(parseFloat(adjustAmount) * 100)
    if (isNaN(amount) || amount < 0) return

    let newBalance: number
    switch (adjustMode) {
      case 'add':
        newBalance = child.balance + amount
        break
      case 'remove':
        newBalance = Math.max(0, child.balance - amount)
        break
      case 'set':
        newBalance = amount
        break
    }

    setIsSubmitting(true)
    try {
      await adjustBalance({
        id: child._id,
        newBalance,
        note: adjustNote.trim() || undefined,
      })
      setIsAdjustOpen(false)
      setAdjustAmount('')
      setAdjustNote('')
      setAdjustMode('add')
    } finally {
      setIsSubmitting(false)
    }
  }

  const completedChores = chores?.filter((c) => c?.status === 'completed') ?? []
  const pendingChores = chores?.filter((c) => c?.status === 'pending') ?? []

  return (
    <div className="space-y-6">
      <Link to="/children">
        <Button variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Children
        </Button>
      </Link>

      {/* Child Header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 py-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-5xl">
            {child.avatarEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">{child.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
              <span>
                Access code: <strong>{child.accessCode}</strong>
              </span>
              <Button variant="ghost" size="sm" onClick={handleRegenerateCode}>
                <RefreshCw className="mr-1 h-3 w-3" />
                Regenerate
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground break-all">
              Kid URL: <code className="bg-muted px-1 rounded">/kid/{child.accessCode}</code>
            </p>
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-3xl sm:text-4xl font-bold text-green-600">
              <Money cents={child.balance} currency={currency} />
            </p>
            <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setAdjustAmount('')
                  setAdjustMode('add')
                  setAdjustNote('')
                  setIsAdjustOpen(true)
                }}
              >
                <PenLine className="mr-2 h-4 w-4" />
                Adjust
              </Button>
              <Button
                onClick={() => {
                  setWithdrawAmount((child.balance / 100).toFixed(2))
                  setIsWithdrawOpen(true)
                }}
                disabled={child.balance === 0}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Withdraw
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="chores">
        <TabsList>
          <TabsTrigger value="chores">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Chores
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="withdrawals">
            <Wallet className="mr-2 h-4 w-4" />
            Withdrawals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chores" className="mt-4">
          {pendingChores.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck />}
              title="No pending chores"
              description="Schedule chores for this child to see them here"
              action={
                <Link to="/schedule">
                  <Button>Schedule Chore</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {pendingChores.map((chore) => {
                if (!chore) return null
                const myParticipation = chore.myParticipation

                return (
                  <Card key={chore._id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">
                        {chore.template?.icon ?? '📋'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {chore.template?.name ?? 'Unknown Chore'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Due: {chore.dueDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          <Money cents={chore.totalReward} currency={currency} />
                        </p>
                      </div>
                      <Badge
                        variant={
                          myParticipation?.status === 'done' ? 'reviewing' : 'pending'
                        }
                      >
                        {myParticipation?.status === 'done' ? 'Awaiting Review' : 'Pending'}
                      </Badge>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {completedChores.length === 0 ? (
            <EmptyState
              icon={<History />}
              title="No completed chores yet"
              description="Completed chores will appear here"
            />
          ) : (
            <div className="space-y-3">
              {completedChores.map((chore) => {
                if (!chore) return null
                const myParticipation = chore.myParticipation

                return (
                  <Card key={chore._id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">
                        {chore.template?.icon ?? '📋'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {chore.template?.name ?? 'Unknown Chore'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {chore.dueDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money
                          cents={myParticipation?.earnedReward ?? 0}
                          currency={currency}
                          showSign
                          colorize
                          className="font-semibold"
                        />
                        {chore.isJoined && myParticipation?.effortPercent && (
                          <p className="text-xs text-muted-foreground">
                            {myParticipation.effortPercent}% effort
                          </p>
                        )}
                      </div>
                      <Badge variant={chore.quality ?? 'default'}>
                        {chore.quality ?? 'N/A'}
                      </Badge>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          {!withdrawals || withdrawals.length === 0 ? (
            <EmptyState
              icon={<Wallet />}
              title="No balance history yet"
              description="Withdrawals and adjustments will appear here"
            />
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => {
                const isPositive = withdrawal.amount > 0
                const icon = isPositive ? '💰' : '💸'
                const bgColor = isPositive ? 'bg-green-100' : 'bg-red-100'
                const label = isPositive ? 'Balance added' : 'Withdrawal'

                return (
                  <Card key={withdrawal._id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bgColor} text-xl`}>
                        {icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          {withdrawal.note || 'No note'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money
                          cents={withdrawal.amount}
                          currency={currency}
                          showSign
                          colorize
                          className="font-semibold"
                        />
                        <p className="text-xs text-muted-foreground">
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Withdraw Dialog */}
      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Balance</DialogTitle>
            <DialogDescription>
              Withdraw from {child.name}'s balance of{' '}
              <Money cents={child.balance} currency={currency} />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(child.balance / 100).toFixed(2)}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                placeholder="e.g., Bought toy"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                parseFloat(withdrawAmount) <= 0 ||
                parseFloat(withdrawAmount) * 100 > child.balance ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Processing...' : 'Withdraw'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Balance</DialogTitle>
            <DialogDescription>
              Current balance: <Money cents={child.balance} currency={currency} />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Action Mode Selector */}
            <div className="flex gap-2">
              <Button
                variant={adjustMode === 'add' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setAdjustMode('add')
                  setAdjustAmount('')
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
              <Button
                variant={adjustMode === 'remove' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setAdjustMode('remove')
                  setAdjustAmount('')
                }}
              >
                <Minus className="mr-1 h-4 w-4" />
                Remove
              </Button>
              <Button
                variant={adjustMode === 'set' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setAdjustMode('set')
                  setAdjustAmount((child.balance / 100).toFixed(2))
                }}
              >
                <Settings2 className="mr-1 h-4 w-4" />
                Set
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjust-amount">
                {adjustMode === 'add' && `Amount to Add (${currency})`}
                {adjustMode === 'remove' && `Amount to Remove (${currency})`}
                {adjustMode === 'set' && `New Balance (${currency})`}
              </Label>
              <Input
                id="adjust-amount"
                type="number"
                step="0.01"
                min="0"
                max={adjustMode === 'remove' ? (child.balance / 100).toFixed(2) : undefined}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0.00"
              />
              {adjustAmount && !isNaN(parseFloat(adjustAmount)) && (
                <p className="text-sm">
                  {(() => {
                    const amount = Math.round(parseFloat(adjustAmount) * 100)
                    let newBal: number
                    switch (adjustMode) {
                      case 'add':
                        newBal = child.balance + amount
                        break
                      case 'remove':
                        newBal = Math.max(0, child.balance - amount)
                        break
                      case 'set':
                        newBal = amount
                        break
                    }
                    const diff = newBal - child.balance
                    return (
                      <span>
                        New balance:{' '}
                        <Money cents={newBal} currency={currency} className="font-semibold" />
                        {diff !== 0 && (
                          <span className="ml-2">
                            (<Money cents={diff} currency={currency} showSign colorize />)
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-note">Reason (optional)</Label>
              <Input
                id="adjust-note"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder={
                  adjustMode === 'add'
                    ? 'e.g., Birthday money'
                    : adjustMode === 'remove'
                      ? 'e.g., Lost money'
                      : 'e.g., Correction'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={
                !adjustAmount ||
                parseFloat(adjustAmount) < 0 ||
                isNaN(parseFloat(adjustAmount)) ||
                (adjustMode === 'remove' && parseFloat(adjustAmount) * 100 > child.balance) ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Saving...' : adjustMode === 'add' ? 'Add' : adjustMode === 'remove' ? 'Remove' : 'Set Balance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
