import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface SwitchFieldProps {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  highlight?: boolean
  className?: string
}

export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  highlight = false,
  className,
}: SwitchFieldProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-3',
        highlight && 'bg-amber-50/50',
        className
      )}
    >
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
