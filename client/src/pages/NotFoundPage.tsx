import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-faint">
        <Compass className="size-5" aria-hidden="true" />
      </span>

      <div className="space-y-1.5">
        <p className="text-2xl font-semibold tracking-tight text-ink">Page not found</p>
        <p className="max-w-sm text-sm text-ink-faint">
          That page does not exist. It may have been moved, or the link may be out of date.
        </p>
      </div>

      <Button variant="primary" size="sm" to="/">
        Back to dashboard
      </Button>

      <Link
        to="/transactions"
        className="text-xs text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Browse transactions
      </Link>
    </div>
  )
}
