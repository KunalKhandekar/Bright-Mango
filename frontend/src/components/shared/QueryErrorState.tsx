import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Shown in place of card content when a query fails, so cards never sit on a skeleton forever. */
export function QueryErrorState({
  message = "Couldn't load this data.",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="text-muted-foreground size-6" />
      </div>
      <h3 className="text-base font-medium">{message}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        Check your connection or try again.
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
