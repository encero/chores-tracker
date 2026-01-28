import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface EmojiPickerProps {
  options: ReadonlyArray<string>
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export function EmojiPicker({
  options,
  value,
  onChange,
  label,
  className,
}: EmojiPickerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-2">
        {options.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors',
              value === emoji
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

export const CHORE_ICONS = ['🛏️', '🧹', '🍽️', '🗑️', '🐕', '📚', '🧺', '🚿', '🌱', '🚗', '✏️', '🧼'] as const
export const AVATAR_EMOJIS = ['👦', '👧', '🧒', '👶', '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯'] as const
