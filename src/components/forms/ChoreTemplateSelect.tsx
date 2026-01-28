import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ChoreTemplate {
  _id: string
  name: string
  icon: string
}

interface ChoreTemplateSelectProps {
  templates: Array<ChoreTemplate> | undefined
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  className?: string
}

export function ChoreTemplateSelect({
  templates,
  value,
  onChange,
  label = 'Chore',
  placeholder = 'Select a chore',
  className,
}: ChoreTemplateSelectProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {templates?.map((template) => (
            <SelectItem key={template._id} value={template._id}>
              {template.icon} {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
