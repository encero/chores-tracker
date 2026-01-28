import { Star, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import type { QualityRating } from '@/lib/currency'
import { QUALITY_COEFFICIENTS } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'

interface QualityRatingButtonsProps {
  value?: QualityRating
  onChange: (quality: QualityRating) => void
  baseReward?: number
  currency?: string
  disabled?: boolean
  showMoney?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function QualityRatingButtons({
  value,
  onChange,
  baseReward = 0,
  currency = '$',
  disabled = false,
  showMoney = false,
  size = 'sm',
  className,
}: QualityRatingButtonsProps) {
  const buttonClass = size === 'sm' ? 'h-8 px-2' : 'h-9 px-3'
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  const buttons: Array<{ quality: QualityRating; icon: typeof X; label: string; borderColor: string; textColor: string; bgColor: string; activeColor: string }> = [
    {
      quality: 'failed',
      icon: X,
      label: 'Fail',
      borderColor: 'border-gray-300',
      textColor: 'text-gray-600',
      bgColor: 'hover:bg-gray-50',
      activeColor: 'border-gray-500 bg-gray-100 text-gray-700',
    },
    {
      quality: 'bad',
      icon: ThumbsDown,
      label: 'Bad',
      borderColor: 'border-red-200',
      textColor: 'text-red-600',
      bgColor: 'hover:bg-red-50',
      activeColor: 'border-red-500 bg-red-50 text-red-700',
    },
    {
      quality: 'good',
      icon: ThumbsUp,
      label: 'Good',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-600',
      bgColor: 'hover:bg-blue-50',
      activeColor: 'border-blue-500 bg-blue-50 text-blue-700',
    },
    {
      quality: 'excellent',
      icon: Star,
      label: 'Excellent',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-600',
      bgColor: 'hover:bg-amber-50',
      activeColor: 'border-amber-500 bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {buttons.map(({ quality, icon: Icon, label, borderColor, textColor, bgColor, activeColor }) => {
        const isActive = value === quality
        const reward = Math.round(baseReward * QUALITY_COEFFICIENTS[quality])

        return (
          <Button
            key={quality}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              buttonClass,
              isActive ? activeColor : `${borderColor} ${textColor} ${bgColor}`
            )}
            onClick={() => onChange(quality)}
            disabled={disabled}
          >
            <Icon className={cn(iconClass, showMoney && 'sm:mr-1')} />
            {showMoney ? (
              <span className="ml-1 text-xs">
                <Money cents={reward} currency={currency} />
              </span>
            ) : (
              <span className="hidden sm:inline ml-1">{label}</span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
