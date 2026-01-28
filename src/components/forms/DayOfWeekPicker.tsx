import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const

interface DayOfWeekPickerProps {
  selected: Array<number>
  onToggle: (day: number) => void
  label?: string
  className?: string
}

export function DayOfWeekPicker({
  selected,
  onToggle,
  label,
  className,
}: DayOfWeekPickerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-1">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => onToggle(day.value)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors',
              selected.includes(day.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export { DAYS_OF_WEEK }
