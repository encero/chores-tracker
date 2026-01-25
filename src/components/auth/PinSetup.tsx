import { useCallback, useState } from 'react'
import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PinSetupProps {
  onComplete: (pin: string) => Promise<void>
}

type Step = 'enter' | 'confirm'

export function PinSetup({ onComplete }: PinSetupProps) {
  const [step, setStep] = useState<Step>('enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const currentPin = step === 'enter' ? pin : confirmPin
  const setCurrentPin = step === 'enter' ? setPin : setConfirmPin

  const handleDigit = useCallback(
    (digit: string) => {
      if (currentPin.length < 6) {
        setCurrentPin((prev) => prev + digit)
        setError(null)
      }
    },
    [currentPin.length, setCurrentPin]
  )

  const handleDelete = useCallback(() => {
    setCurrentPin((prev) => prev.slice(0, -1))
    setError(null)
  }, [setCurrentPin])

  const handleClear = useCallback(() => {
    setCurrentPin('')
    setError(null)
  }, [setCurrentPin])

  const handleNext = useCallback(async () => {
    if (currentPin.length < 4) {
      setError('PIN must be at least 4 digits')
      return
    }

    if (step === 'enter') {
      setStep('confirm')
    } else {
      // Confirm step
      if (confirmPin !== pin) {
        setError('PINs do not match')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setConfirmPin('')
        return
      }

      setIsLoading(true)
      try {
        await onComplete(pin)
      } catch {
        setError('Failed to set PIN')
      } finally {
        setIsLoading(false)
      }
    }
  }, [currentPin.length, step, confirmPin, pin, onComplete])

  const handleBack = useCallback(() => {
    setStep('enter')
    setConfirmPin('')
    setError(null)
  }, [])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          {step === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {step === 'enter'
            ? 'Choose a 4-6 digit PIN to secure parent access'
            : 'Enter your PIN again to confirm'}
        </p>
      </div>

      {/* PIN Display */}
      <div
        className={cn(
          "flex gap-3 transition-transform",
          shake && "animate-shake"
        )}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-colors",
              i < currentPin.length
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
                disabled={currentPin.length === 0 || isLoading}
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

      {/* Action Buttons */}
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button
          size="lg"
          className="w-full"
          onClick={handleNext}
          disabled={currentPin.length < 4 || isLoading}
        >
          {isLoading
            ? 'Setting up...'
            : step === 'enter'
              ? 'Continue'
              : 'Set PIN'}
        </Button>

        {step === 'confirm' && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={handleBack}
            disabled={isLoading}
          >
            Go back
          </Button>
        )}

        {step === 'enter' && (
          <Button
            variant="link"
            className="text-muted-foreground"
            onClick={handleClear}
            disabled={currentPin.length === 0 || isLoading}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
