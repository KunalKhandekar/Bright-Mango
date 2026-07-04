import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { listMyOrders } from '@/api/payments'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatDateTime, formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  paid: 'default',
  pending: 'secondary',
  failed: 'destructive',
}

export function OrdersPage() {
  const { data, isPending } = useQuery({ queryKey: keys.myOrders, queryFn: listMyOrders })
  const orders = data?.orders ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Order history" description="All your course purchases." />

      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders yet"
          description="When you purchase a course, it will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="max-w-56 truncate font-medium">
                    {typeof order.courseId === 'object' ? order.courseId.title : 'Course'}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    {formatPrice(order.finalAmount)}
                    {order.finalAmount !== order.amount && (
                      <span className="text-muted-foreground ml-1.5 text-xs line-through">
                        {formatPrice(order.amount)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
