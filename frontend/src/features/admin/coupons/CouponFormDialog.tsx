import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { listMyCourses } from '@/api/courses'
import { createCoupon, updateCoupon } from '@/api/coupons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/error-messages'
import { paiseToRupees, rupeesToPaise } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { Coupon } from '@/types/models'

interface CouponFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  coupon?: Coupon | null
}

/** Select sentinel for "valid on every course" (courseId omitted in the payload). */
const ALL_COURSES = '__all__'

export function CouponFormDialog({ open, onOpenChange, coupon }: CouponFormDialogProps) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('percentage')
  const [value, setValue] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'picker'],
    queryFn: () => listMyCourses({ limit: 100 }),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    if (coupon) {
      setCourseId(
        coupon.courseId === null
          ? ALL_COURSES
          : typeof coupon.courseId === 'object'
            ? coupon.courseId._id
            : coupon.courseId,
      )
      setCode(coupon.code)
      setDiscountType(coupon.discountType)
      setValue(
        coupon.discountType === 'fixed'
          ? String(paiseToRupees(coupon.value))
          : String(coupon.value),
      )
      setUsageLimit(coupon.usageLimit ? String(coupon.usageLimit) : '')
      setExpiresAt(coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '')
    } else {
      setCourseId('')
      setCode('')
      setDiscountType('percentage')
      setValue('')
      setUsageLimit('')
      setExpiresAt('')
    }
  }, [open, coupon])

  const save = useMutation({
    mutationFn: () => {
      const numericValue =
        discountType === 'fixed' ? rupeesToPaise(value || '0') : Math.round(Number(value || 0))
      const shared = {
        discountType,
        value: numericValue,
        usageLimit: usageLimit ? Math.round(Number(usageLimit)) : 0,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
      }
      return coupon
        ? updateCoupon(coupon._id, shared)
        : createCoupon({
            ...shared,
            courseId: courseId === ALL_COURSES ? undefined : courseId,
            code: code.trim().toUpperCase(),
          })
    },
    onSuccess: () => {
      toast.success(coupon ? 'Coupon updated' : 'Coupon created')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: keys.coupons })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const valid =
    (coupon || (courseId && code.trim().length >= 3)) &&
    Number(value) > 0 &&
    (discountType !== 'percentage' || Number(value) <= 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{coupon ? `Edit ${coupon.code}` : 'New coupon'}</DialogTitle>
          <DialogDescription>
            {coupon
              ? 'Adjust the discount, limits or expiry.'
              : 'Create a discount code for one of your courses.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!coupon && (
            <>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={coursesQuery.isPending ? 'Loading…' : 'Choose a course'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_COURSES}>All courses</SelectItem>
                    {(coursesQuery.data?.courses ?? []).map((course) => (
                      <SelectItem key={course._id} value={course._id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Code</Label>
                <Input
                  id="coupon-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="LAUNCH50"
                  className="uppercase"
                  minLength={3}
                  maxLength={40}
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as 'fixed' | 'percentage')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage off</SelectItem>
                  <SelectItem value="fixed">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-value">
                {discountType === 'percentage' ? 'Percent (%)' : 'Amount (₹)'}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                min={1}
                max={discountType === 'percentage' ? 100 : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="coupon-limit">Usage limit</Label>
              <Input
                id="coupon-limit"
                type="number"
                min={0}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="0 = unlimited"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-expiry">Expires</Label>
              <Input
                id="coupon-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
