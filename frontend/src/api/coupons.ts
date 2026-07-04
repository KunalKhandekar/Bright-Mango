import { api, unwrap } from '@/lib/axios'
import type { Coupon } from '@/types/models'

export function validateCoupon(input: { code: string; courseId: string }) {
  return unwrap<{ discount: number; finalAmount: number; originalAmount: number }>(
    api.post('/coupons/validate', input),
  )
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export function listCoupons() {
  return unwrap<{ coupons: Coupon[] }>(api.get('/coupons'))
}

export interface CouponInput {
  /** Omit for an all-courses coupon */
  courseId?: string
  code: string
  discountType: 'fixed' | 'percentage'
  value: number
  usageLimit?: number
  expiresAt?: string
}

export function createCoupon(input: CouponInput) {
  return unwrap<{ coupon: Coupon }>(api.post('/coupons', input))
}

export function updateCoupon(
  id: string,
  input: Partial<Omit<CouponInput, 'courseId' | 'code'> & { isActive: boolean }>,
) {
  return unwrap<{ coupon: Coupon }>(api.patch(`/coupons/${id}`, input))
}

export function deleteCoupon(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/coupons/${id}`))
}
