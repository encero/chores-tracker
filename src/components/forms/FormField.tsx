import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface FormFieldProps extends Omit<ComponentProps<typeof Input>, 'onChange'> {
  label: string
  error?: string
  onChange?: (value: string) => void
}

export function FormField({
  label,
  id,
  error,
  className,
  onChange,
  ...inputProps
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...inputProps}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
