import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'

interface Participant {
  childId: string
  child?: {
    avatarEmoji: string
    name: string
  } | null
}

interface EffortSliderProps {
  participant: Participant
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export function EffortSlider({
  participant,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  className,
}: EffortSliderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          {participant.child?.avatarEmoji} {participant.child?.name}
        </span>
        <span className="font-medium">{value.toFixed(0)}%</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}
