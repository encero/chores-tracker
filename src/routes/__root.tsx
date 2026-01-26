import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import ConvexProvider from '../integrations/convex/provider'
import { AuthProvider } from '../components/auth/AuthGuard'
import { getEnvScript } from '../lib/env'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'Chores Tracker',
      },
      // iOS home screen app meta tags
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Chores Tracker',
      },
      // Android/Chrome
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      // Theme color for browser UI
      {
        name: 'theme-color',
        content: '#000000',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      // PWA manifest
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      // Apple touch icons
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '192x192',
        href: '/logo192.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '512x512',
        href: '/logo512.png',
      },
    ],
  }),

  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: getEnvScript() }} />
        <ConvexProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ConvexProvider>
        <Scripts />
      </body>
    </html>
  )
}
