import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PriceTagProps {
  /** paise */
  price: number
  /** paise — shown struck through when different from price */
  originalPrice?: number
  className?: string
}

export function PriceTag({ price, originalPrice, className }: PriceTagProps) {
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-semibold">{formatPrice(price)}</span>
      {originalPrice !== undefined && originalPrice !== price && (
        <span className="text-muted-foreground text-sm line-through">
          {formatPrice(originalPrice)}
        </span>
      )}
    </span>
  )
}
