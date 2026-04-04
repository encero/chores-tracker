import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/review')({
  component: ReviewRedirect,
})

function ReviewRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: '/', replace: true })
  }, [navigate])

  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
