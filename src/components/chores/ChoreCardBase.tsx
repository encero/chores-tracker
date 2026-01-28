import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface ChoreCardBaseProps {
  icon: string
  iconClassName?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
  variant?: 'default' | 'completed' | 'overdue' | 'highlighted'
}

const variantStyles = {
  default: 'border-purple-200 bg-white',
  completed: 'border-green-200 bg-green-50/50',
  overdue: 'border-orange-300 bg-orange-50/50',
  highlighted: 'border-green-400 bg-green-50',
}

const iconVariantStyles = {
  default: 'bg-gradient-to-br from-purple-100 to-pink-100',
  completed: 'bg-gradient-to-br from-green-100 to-emerald-100',
  overdue: 'bg-gradient-to-br from-orange-100 to-amber-100',
  highlighted: 'bg-gradient-to-br from-green-100 to-emerald-100',
}

export function ChoreCardBase({
  icon,
  iconClassName,
  children,
  actions,
  className,
  variant = 'default',
}: ChoreCardBaseProps) {
  return (
    <Card className={cn('border-2 transition-all', variantStyles[variant], className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-xl text-3xl shadow-sm',
              iconVariantStyles[variant],
              iconClassName
            )}
          >
            {icon}
          </div>
          <div className="flex-1">{children}</div>
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
