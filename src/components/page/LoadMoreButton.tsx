import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoadMoreButtonProps {
  hasMore: boolean
  onLoadMore: () => void
  remaining?: number
}

export function LoadMoreButton({ hasMore, onLoadMore, remaining }: LoadMoreButtonProps) {
  if (!hasMore) return null

  return (
    <div className="flex justify-center pt-2">
      <Button variant="outline" onClick={onLoadMore}>
        <ChevronDown className="mr-2 h-4 w-4" />
        Load More{remaining !== undefined && ` (${remaining} remaining)`}
      </Button>
    </div>
  )
}
