import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgePercent, CreditCard, Loader2, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { getCourseBySlug } from '@/api/courses'
import { getMyEnrollmentForCourse } from '@/api/enrollments'
import { createOrder, verifyPayment } from '@/api/payments'
import { validateCoupon } from '@/api/coupons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { errorMessage } from '@/lib/error-messages'
import { formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { isApiError } from '@/types/api'
import { useAuthStore } from '@/stores/auth.store'
import { useRazorpay } from '@/hooks/use-razorpay'

interface AppliedCoupon {
  code: string
  discount: number
  finalAmount: number
}

export function CheckoutPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const razorpay = useRazorpay()

  const [couponDraft, setCouponDraft] = useState('')
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [verifyFailed, setVerifyFailed] = useState(false)

  const courseQuery = useQuery({
    queryKey: keys.course(slug),
    queryFn: () => getCourseBySlug(slug),
  })
  const course = courseQuery.data?.course

  const applyCoupon = useMutation({
    mutationFn: () => validateCoupon({ code: couponDraft.trim(), courseId: course!._id }),
    onSuccess: (data) => {
      setCoupon({ code: couponDraft.trim().toUpperCase(), ...data })
      setCouponError(null)
    },
    onError: (err) => {
      setCoupon(null)
      setCouponError(errorMessage(err))
    },
  })

  const goToCourse = () => navigate(`/learn/${course!._id}`)

  const handlePay = async () => {
    if (!course) return
    setPaying(true)
    setVerifyFailed(false)
    try {
      const order = await createOrder({
        courseId: course._id,
        couponCode: coupon?.code,
      })
      razorpay.open({
        key: order.keyId,
        order_id: order.razorpayOrderId,
        amount: order.finalAmount,
        currency: order.currency,
        name: 'BrightMango',
        description: course.title,
        prefill: { name: user?.name, email: user?.email },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            await queryClient.invalidateQueries({ queryKey: ['enrollments'] })
            await queryClient.invalidateQueries({ queryKey: keys.myOrders })
            toast.success("You're enrolled! Happy learning.")
            goToCourse()
          } catch (err) {
            if (isApiError(err, 'PAYMENT_VERIFICATION_FAILED')) {
              setVerifyFailed(true)
            } else {
              toast.error(errorMessage(err))
            }
            setPaying(false)
          }
        },
      })
    } catch (err) {
      setPaying(false)
      if (isApiError(err, 'ALREADY_ENROLLED')) {
        toast.info("You're already enrolled in this course.")
        goToCourse()
      } else if (isApiError(err, 'INTEGRATION_NOT_CONFIGURED')) {
        toast.error('Payments are unavailable right now. Please try again later.')
      } else {
        toast.error(errorMessage(err))
      }
    }
  }

  const recheckEnrollment = async () => {
    const { hasAccess } = await queryClient.fetchQuery({
      queryKey: keys.enrollmentAccess(course!._id),
      queryFn: () => getMyEnrollmentForCourse(course!._id),
      staleTime: 0,
    })
    if (hasAccess) {
      toast.success('Payment confirmed — you are enrolled!')
      goToCourse()
    } else {
      toast.info('Not confirmed yet. Give it a few seconds and re-check.')
    }
  }

  if (courseQuery.isPending) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!course) {
    return (
      <EmptyState
        title="Course not found"
        action={
          <Button asChild variant="outline">
            <Link to="/">Browse courses</Link>
          </Button>
        }
      />
    )
  }

  const payable = coupon ? coupon.finalAmount : course.price

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {course.thumbnailUrl && (
              <img
                src={course.thumbnailUrl}
                alt=""
                className="aspect-video w-28 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="font-medium">{course.title}</p>
              {course.shortDescription && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {course.shortDescription}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Coupon */}
          {coupon ? (
            <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <BadgePercent className="size-4 text-green-600 dark:text-green-500" />
                <span className="font-medium">{coupon.code}</span> applied
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove coupon"
                onClick={() => {
                  setCoupon(null)
                  setCouponDraft('')
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input
                  placeholder="Coupon code"
                  value={couponDraft}
                  onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                  className="uppercase"
                />
                <Button
                  variant="outline"
                  disabled={!couponDraft.trim() || applyCoupon.isPending}
                  onClick={() => applyCoupon.mutate()}
                >
                  {applyCoupon.isPending && <Loader2 className="size-4 animate-spin" />}
                  Apply
                </Button>
              </div>
              {couponError && <p className="text-destructive text-sm">{couponError}</p>}
            </div>
          )}

          <Separator />

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price</span>
              <span>{formatPrice(course.price)}</span>
            </div>
            {coupon && (
              <div className="flex justify-between text-green-600 dark:text-green-500">
                <span>Discount</span>
                <span>−{formatPrice(coupon.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatPrice(payable)}</span>
            </div>
          </div>

          {verifyFailed ? (
            <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>
                Your payment went through but we couldn't confirm it yet. It usually completes
                automatically within a minute — no money is lost.
              </p>
              <Button variant="outline" size="sm" onClick={recheckEnrollment}>
                <RefreshCw className="size-3.5" /> Check again
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              disabled={paying || !razorpay.ready}
              onClick={handlePay}
            >
              {paying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              Pay {formatPrice(payable)}
            </Button>
          )}

          <p className="text-muted-foreground text-center text-xs">
            Secure payment powered by Razorpay
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
