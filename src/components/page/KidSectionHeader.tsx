import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TTSButton } from '@/components/ui/tts-button'

interface KidSectionHeaderProps {
  icon: ReactNode
  text: string
  ttsLanguage?: string
  className?: string
}

export function KidSectionHeader({
  icon,
  text,
  ttsLanguage = 'cs-CZ',
  className,
}: KidSectionHeaderProps) {
  return (
    <h2 className={cn('mb-4 flex items-center gap-2 text-xl font-bold text-purple-900', className)}>
      {icon}
      {text}
      <TTSButton text={text} language={ttsLanguage} />
    </h2>
  )
}
