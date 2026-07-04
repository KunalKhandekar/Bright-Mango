import { api, unwrap } from '@/lib/axios'
import type { Order } from '@/types/models'

export interface CreateOrderResult {
  orderId: string
  razorpayOrderId: string
  /** paise */
  amount: number
  /** paise */
  finalAmount: number
  currency: string
  keyId: string
}

export function createOrder(input: { courseId: string; couponCode?: string }) {
  return unwrap<CreateOrderResult>(api.post('/orders', input))
}

export function verifyPayment(input: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}) {
  return unwrap<{ fulfilled: boolean }>(api.post('/payments/verify', input))
}

export function listMyOrders() {
  return unwrap<{ orders: Order[] }>(api.get('/orders/me'))
}
