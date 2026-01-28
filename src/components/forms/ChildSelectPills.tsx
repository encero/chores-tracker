import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface Child {
  _id: string
  name: string
  avatarEmoji: string
}

interface ChildSelectPillsProps {
  children: Array<Child>
  selected: Array<string>
  onToggle: (childId: string) => void
  label?: string
  className?: string
}

export function ChildSelectPills({
  children,
  selected,
  onToggle,
  label,
  className,
}: ChildSelectPillsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-2">
        {children.map((child) => (
          <button
            key={child._id}
            type="button"
            onClick={() => onToggle(child._id)}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
              selected.includes(child._id)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            <span>{child.avatarEmoji}</span>
            <span>{child.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
