import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface RewardInputProps {
  value: string
  onChange: (value: string) => void
  currency: string
  isTotal?: boolean
  className?: string
}

export function RewardInput({
  value,
  onChange,
  currency,
  isTotal = false,
  className,
}: RewardInputProps) {
  const label = isTotal ? `Total Reward (${currency})` : `Reward (${currency})`

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="reward">{label}</Label>
      <Input
        id="reward"
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
      />
    </div>
  )
}
