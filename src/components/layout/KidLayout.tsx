import { Link } from '@tanstack/react-router'
import { Home } from 'lucide-react'
import { Money } from '@/components/ui/money'

interface KidLayoutProps {
  children: React.ReactNode
  childName: string
  avatarEmoji: string
  balance: number
  currency?: string
}

export function KidLayout({
  children,
  childName,
  avatarEmoji,
  balance,
  currency = '$',
}: KidLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      {/* Kid-friendly Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="container flex h-20 items-center justify-between px-4">
          {/* Back to Home Button */}
          <Link
            to="/login"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
            title="Zpět domů"
          >
            <Home className="h-5 w-5" />
          </Link>

          {/* Avatar and Name */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 to-orange-200 text-3xl shadow-md">
              {avatarEmoji}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ahoj,</p>
              <h1 className="text-xl font-bold text-purple-900">{childName}!</h1>
            </div>
          </div>

          {/* Balance Display - Piggy Bank Style */}
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-100 to-pink-200 px-4 py-2 shadow-md">
            <span className="text-2xl">🐷</span>
            <div className="text-right">
              <p className="text-xs text-pink-700">Tvůj zůstatek</p>
              <p className="text-lg font-bold text-pink-900">
                <Money cents={balance} currency={currency} />
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">{children}</main>
    </div>
  )
}
