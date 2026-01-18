import { Volume2, VolumeX } from 'lucide-react'
import { useTTS } from '@/hooks/useTTS'

interface TTSButtonProps {
  text: string
  className?: string
}

export function TTSButton({ text, className = '' }: TTSButtonProps) {
  const { speak, stop, isSpeaking, isSupported } = useTTS()

  if (!isSupported) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering parent click handlers
    if (isSpeaking) {
      stop()
    } else {
      speak(text)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-full p-2 transition-colors hover:bg-purple-100 active:bg-purple-200 ${className}`}
      aria-label={isSpeaking ? 'Stop reading' : `Read "${text}" aloud`}
    >
      {isSpeaking ? (
        <VolumeX className="h-5 w-5 text-purple-600" />
      ) : (
        <Volume2 className="h-5 w-5 text-purple-500" />
      )}
    </button>
  )
}
