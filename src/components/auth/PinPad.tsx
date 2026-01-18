import { useState, useCallback } from 'react'
import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface PinPadProps {
  onSubmit: (pin: string, rememberMe: boolean) => Promise<boolean>
  title?: string
  subtitle?: string
  showRememberMe?: boolean
  minLength?: number
  maxLength?: number
}

export function PinPad({
  onSubmit,
  title = 'Zadej PIN',
  subtitle,
  showRememberMe = true,
  minLength = 4,
  maxLength = 6,
}: PinPadProps) {
  const [pin, setPin] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < maxLength) {
        setPin((prev) => prev + digit)
        setError(null)
      }
    },
    [pin.length, maxLength]
  )

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    setError(null)
  }, [])

  const handleClear = useCallback(() => {
    setPin('')
    setError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (pin.length < minLength) {
      setError(`PIN musí mít alespoň ${minLength} číslic`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await onSubmit(pin, rememberMe)
      if (!success) {
        setError('Nesprávný PIN')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setPin('')
      }
    } catch {
      setError('Nastala chyba')
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }, [pin, minLength, rememberMe, onSubmit])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>

      {/* PIN Display */}
      <div
        className={cn(
          "flex gap-3 transition-transform",
          shake && "animate-shake"
        )}
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-colors",
              i < pin.length
                ? "border-primary bg-primary"
                : "border-muted-foreground/30"
            )}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((digit, i) => (
          <div key={i} className="flex items-center justify-center">
            {digit === '' ? (
              <div className="h-16 w-16" />
            ) : digit === 'del' ? (
              <Button
                variant="ghost"
                size="lg"
                className="h-16 w-16 rounded-full text-muted-foreground"
                onClick={handleDelete}
                disabled={pin.length === 0 || isLoading}
              >
                <Delete className="h-6 w-6" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className="h-16 w-16 rounded-full text-2xl font-semibold hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleDigit(digit)}
                disabled={isLoading}
              >
                {digit}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Remember Me */}
      {showRememberMe && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label htmlFor="remember" className="text-sm text-muted-foreground">
            Zapamatovat na 30 dní
          </Label>
        </div>
      )}

      {/* Submit Button */}
      <Button
        size="lg"
        className="w-full max-w-xs"
        onClick={handleSubmit}
        disabled={pin.length < minLength || isLoading}
      >
        {isLoading ? 'Kontroluji...' : 'Odemknout'}
      </Button>

      {/* Clear Button */}
      <Button
        variant="link"
        className="text-muted-foreground"
        onClick={handleClear}
        disabled={pin.length === 0 || isLoading}
      >
        Smazat
      </Button>
    </div>
  )
}
