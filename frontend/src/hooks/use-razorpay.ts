import { useEffect, useState } from 'react'

export interface RazorpayOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  handler: (response: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

let loadPromise: Promise<boolean> | null = null

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      loadPromise = null
      resolve(false)
    }
    document.body.appendChild(script)
  })
  return loadPromise
}

/** Lazily loads the Razorpay checkout script; `open` throws if it failed to load. */
export function useRazorpay() {
  const [ready, setReady] = useState(!!window.Razorpay)

  useEffect(() => {
    void loadRazorpay().then(setReady)
  }, [])

  const open = (options: RazorpayOptions) => {
    if (!window.Razorpay) throw new Error('Payment library failed to load')
    new window.Razorpay(options).open()
  }

  return { ready, open }
}
