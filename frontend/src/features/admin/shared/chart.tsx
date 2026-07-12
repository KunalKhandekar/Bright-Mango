import { useMemo, type ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/format'

export type ChartInterval = 'day' | 'month'

export const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days', days: 7, interval: 'day' as const },
  { value: '30d', label: 'Last 30 days', days: 30, interval: 'day' as const },
  { value: '90d', label: 'Last 90 days', days: 90, interval: 'day' as const },
  { value: '12m', label: 'Last 12 months', days: 365, interval: 'month' as const },
]

export interface IsoDateRange {
  from: string
  to: string
}

/** Resolve a RANGE_OPTIONS key into a stable ISO from/to range + bucket interval. */
export function useDateRange(rangeKey: string) {
  const option = RANGE_OPTIONS.find((r) => r.value === rangeKey) ?? RANGE_OPTIONS[1]
  const range = useMemo<IsoDateRange>(() => {
    const to = new Date()
    const from = new Date(to.getTime() - option.days * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [option.days])
  return { range, interval: option.interval, label: option.label }
}

export function RangeSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Zero-fill missing buckets so the time axis is continuous. Buckets are keyed
 * by LOCAL date (en-CA = YYYY-MM-DD) because the backend truncates to IST
 * midnights, which are 18:30 previous-day in UTC.
 */
export function fillBuckets<T extends { date: string }>(
  points: T[],
  from: Date,
  to: Date,
  interval: ChartInterval,
  makeZero: (dateISO: string) => T,
): T[] {
  const keyLength = interval === 'day' ? 10 : 7
  const keyOf = (d: Date) => d.toLocaleDateString('en-CA').slice(0, keyLength)
  const byKey = new Map(points.map((p) => [keyOf(new Date(p.date)), p]))
  const filled: T[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  if (interval === 'month') cursor.setDate(1)
  while (cursor <= to) {
    filled.push(byKey.get(keyOf(cursor)) ?? makeZero(cursor.toISOString()))
    if (interval === 'day') cursor.setDate(cursor.getDate() + 1)
    else cursor.setMonth(cursor.getMonth() + 1)
  }
  return filled
}

/** Axis/tooltip label for a time bucket: "12 Jul 2026" for days, "Jul 26" for months. */
export function bucketLabel(dateISO: string, interval: ChartInterval): string {
  return interval === 'day'
    ? formatDate(dateISO)
    : new Date(dateISO).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

/** Popover-styled frame for recharts Tooltip content. */
export function ChartTooltipFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-sm shadow-md">
      {children}
    </div>
  )
}
