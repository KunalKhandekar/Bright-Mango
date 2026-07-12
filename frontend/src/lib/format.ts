const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

/** Format paise (integer) as rupees, e.g. 149900 → "₹1,499" */
export function formatPrice(paise: number): string {
  if (paise === 0) return 'Free'
  const rupees = paise / 100
  return Number.isInteger(rupees)
    ? inr.format(rupees).replace(/\.00$/, '')
    : inr.format(rupees)
}

/** Rupee input value → paise integer (for admin course/coupon forms) */
export function rupeesToPaise(rupees: string | number): number {
  return Math.round(Number(rupees) * 100)
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

/** 3725 → "1:02:05", 245 → "4:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Like formatDateTime but includes seconds, e.g. "13 Jul 2026, 4:05:09 pm" */
export function formatDateTimeWithSeconds(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Human label for a minute span, e.g. 1440 → "24 hours", 60 → "1 hour", 90 → "90 minutes". */
export function formatMinutesWindow(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return `${h} hour${h === 1 ? '' : 's'}`
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

/** Break a positive millisecond span into a "23h 59m 58s" style countdown label. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (h > 0 || m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

/** Shorten long labels for toasts, e.g. 'Understanding Different Response Ty…' */
export function truncate(text: string, max = 32): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

export function formatRelativeTime(value: string | Date): string {
  const diffMs = Date.now() - new Date(value).getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return formatDate(value)
}
