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
