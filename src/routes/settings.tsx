import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ParentLayout } from '@/components/layout/ParentLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthToken } from '@/hooks/useAuthToken'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <AuthGuard>
      <ParentLayout>
        <SettingsContent />
      </ParentLayout>
    </AuthGuard>
  )
}

function SettingsContent() {
  const token = useAuthToken()
  const settings = useQuery(api.settings.get)
  const updateSettings = useMutation(api.settings.update)
  const changePin = useMutation(api.settings.changePin)

  const [currency, setCurrency] = useState(settings?.currency ?? '$')
  const [sessionDays, setSessionDays] = useState(
    settings?.sessionDurationDays.toString() ?? '7'
  )
  const [ttsLanguage, setTtsLanguage] = useState(settings?.ttsLanguage ?? 'cs-CZ')
  const [saving, setSaving] = useState(false)

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSuccess, setPinSuccess] = useState(false)
  const [changingPin, setChangingPin] = useState(false)

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await updateSettings({
        token,
        currency,
        sessionDurationDays: parseInt(sessionDays),
        ttsLanguage,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePin = async () => {
    setPinError(null)
    setPinSuccess(false)

    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits')
      return
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match')
      return
    }

    setChangingPin(true)
    try {
      const result = await changePin({ token, currentPin, newPin })
      if (result.success) {
        setPinSuccess(true)
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
      } else {
        setPinError(result.error ?? 'Failed to change PIN')
      }
    } catch {
      setPinError('Failed to change PIN')
    } finally {
      setChangingPin(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your app preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Configure currency and session preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency Symbol</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="$">$ (USD)</SelectItem>
                  <SelectItem value="€">€ (EUR)</SelectItem>
                  <SelectItem value="£">£ (GBP)</SelectItem>
                  <SelectItem value="¥">¥ (JPY/CNY)</SelectItem>
                  <SelectItem value="Kč">Kč (CZK)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session">Session Duration (days)</Label>
              <Select value={sessionDays} onValueChange={setSessionDays}>
                <SelectTrigger id="session">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttsLanguage">Text-to-Speech Language</Label>
              <Select value={ttsLanguage} onValueChange={setTtsLanguage}>
                <SelectTrigger id="ttsLanguage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs-CZ">Čeština (Czech)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="de-DE">Deutsch (German)</SelectItem>
                  <SelectItem value="sk-SK">Slovenčina (Slovak)</SelectItem>
                  <SelectItem value="pl-PL">Polski (Polish)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Change PIN */}
        <Card>
          <CardHeader>
            <CardTitle>Change PIN</CardTitle>
            <CardDescription>
              Update your parent access PIN
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <Input
                id="currentPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter current PIN"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter new PIN (4-6 digits)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Confirm new PIN"
              />
            </div>

            {pinError && (
              <p className="text-sm text-destructive">{pinError}</p>
            )}

            {pinSuccess && (
              <p className="text-sm text-green-600">PIN changed successfully!</p>
            )}

            <Button onClick={handleChangePin} disabled={changingPin}>
              {changingPin ? 'Changing...' : 'Change PIN'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
