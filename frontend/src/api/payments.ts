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

// ── Mentor income analytics (all amounts in paise) ──────────────────────────

export interface PaymentsSummary {
  grossRevenue: number
  netRevenue: number
  discountTotal: number
  paidOrders: number
  pendingOrders: number
  failedOrders: number
}

export interface CourseRevenue {
  courseId: string
  title: string
  grossRevenue: number
  netRevenue: number
  orders: number
}

export interface RevenuePoint {
  date: string
  netRevenue: number
  orders: number
}

export interface AdminOrder extends Omit<Order, 'studentId' | 'courseId'> {
  studentId: { _id: string; name?: string; email: string }
  courseId: { _id: string; title: string } | null
}

export interface DateRangeParams {
  from?: string
  to?: string
}

export function getPaymentsSummary(params: DateRangeParams = {}) {
  return unwrap<{ summary: PaymentsSummary }>(api.get('/payments/analytics/summary', { params }))
}

export function getRevenueByCourse(params: DateRangeParams = {}) {
  return unwrap<{ courses: CourseRevenue[] }>(api.get('/payments/analytics/by-course', { params }))
}

export function getRevenueTimeseries(params: DateRangeParams & { interval?: 'day' | 'month' } = {}) {
  return unwrap<{ points: RevenuePoint[]; interval: 'day' | 'month' }>(
    api.get('/payments/analytics/timeseries', { params }),
  )
}

export function listAdminOrders(
  params: { status?: string; courseId?: string; page?: number; limit?: number } = {},
) {
  return unwrap<{ orders: AdminOrder[] }>(api.get('/payments/orders', { params }))
}
