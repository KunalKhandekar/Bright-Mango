import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCoupon, listCoupons, updateCoupon } from '@/api/coupons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { errorMessage } from '@/lib/error-messages'
import { formatDate, formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { Coupon } from '@/types/models'
import { CouponFormDialog } from '@/features/admin/coupons/CouponFormDialog'

export function CouponsPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)

  const { data, isPending } = useQuery({ queryKey: keys.coupons, queryFn: listCoupons })
  const coupons = data?.coupons ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.coupons })

  const toggleActive = useMutation({
    mutationFn: (coupon: Coupon) => updateCoupon(coupon._id, { isActive: !coupon.isActive }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      toast.success('Coupon deleted')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Discount codes for your courses."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New coupon
          </Button>
        }
      />

      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title="No coupons yet"
          description="Create a code to run a discount or reward loyal students."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New coupon
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => {
                const expired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date()
                return (
                  <TableRow key={coupon._id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {coupon.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {typeof coupon.courseId === 'object' ? coupon.courseId.title : '—'}
                    </TableCell>
                    <TableCell>
                      {coupon.discountType === 'percentage'
                        ? `${coupon.value}%`
                        : formatPrice(coupon.value)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {coupon.expiresAt ? (
                        <span className={expired ? 'text-destructive' : ''}>
                          {formatDate(coupon.expiresAt)}
                        </span>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={coupon.isActive}
                        disabled={toggleActive.isPending}
                        onCheckedChange={() => toggleActive.mutate(coupon)}
                        aria-label="Toggle coupon"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit coupon"
                          onClick={() => {
                            setEditing(coupon)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Delete coupon">
                              <Trash2 className="size-3.5" />
                            </Button>
                          }
                          title={`Delete ${coupon.code}?`}
                          description="Students will no longer be able to apply this code."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => remove.mutateAsync(coupon._id).then(() => undefined)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CouponFormDialog open={dialogOpen} onOpenChange={setDialogOpen} coupon={editing} />
    </div>
  )
}
