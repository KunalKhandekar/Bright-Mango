import { useEffect, useRef, useState } from 'react'

/**
 * Counts down to zero. Call `start(seconds)` to (re)arm — e.g. with the
 * OTP resend cooldown returned by the server.
 */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = (from: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(Math.max(0, Math.ceil(from)))
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1 && timerRef.current) clearInterval(timerRef.current)
        return Math.max(0, s - 1)
      })
    }, 1000)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

  return { seconds, active: seconds > 0, start }
}
