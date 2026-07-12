import { Types } from 'mongoose';
import { Order, OrderDoc } from './order.model.js';
import { User } from '../user/user.model.js';
import { Course } from '../course/course.model.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';

/**
 * Read-only income/revenue aggregations for the admin dashboard. Kept separate
 * from payment.service.ts so the money-moving path stays focused.
 *
 * Revenue is bucketed by Order.createdAt of paid orders (not Payment.paidAt) —
 * order creation and capture are minutes apart, and this avoids a join.
 * All amounts are paise.
 */

/** Day/month buckets align to Indian time (the platform charges in INR). */
const BUCKET_TIMEZONE = 'Asia/Kolkata';

export interface DateRange {
  from: Date;
  to: Date;
}

function paidMatch(mentorId: string, range: DateRange) {
  return {
    mentorId: new Types.ObjectId(mentorId),
    status: 'paid',
    createdAt: { $gte: range.from, $lte: range.to },
  };
}

export async function getSummary(mentorId: string, range: DateRange) {
  const [totals, pendingOrders, failedOrders] = await Promise.all([
    Order.aggregate<{ gross: number; net: number; orders: number }>([
      { $match: paidMatch(mentorId, range) },
      {
        $group: {
          _id: null,
          gross: { $sum: '$amount' },
          net: { $sum: '$finalAmount' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.countDocuments({
      mentorId,
      status: 'pending',
      createdAt: { $gte: range.from, $lte: range.to },
    }),
    Order.countDocuments({
      mentorId,
      status: 'failed',
      createdAt: { $gte: range.from, $lte: range.to },
    }),
  ]);

  const t = totals[0] ?? { gross: 0, net: 0, orders: 0 };
  return {
    grossRevenue: t.gross,
    netRevenue: t.net,
    discountTotal: t.gross - t.net,
    paidOrders: t.orders,
    pendingOrders,
    failedOrders,
  };
}

export async function getRevenueByCourse(mentorId: string, range: DateRange) {
  const grouped = await Order.aggregate<{
    _id: Types.ObjectId;
    gross: number;
    net: number;
    orders: number;
  }>([
    { $match: paidMatch(mentorId, range) },
    {
      $group: {
        _id: '$courseId',
        gross: { $sum: '$amount' },
        net: { $sum: '$finalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { net: -1 } },
  ]);

  const courses = await Course.find({ _id: { $in: grouped.map((g) => g._id) } })
    .select('title')
    .lean();
  const titleById = new Map(courses.map((c) => [c._id.toString(), c.title]));

  return grouped.map((g) => ({
    courseId: g._id.toString(),
    title: titleById.get(g._id.toString()) ?? 'Deleted course',
    grossRevenue: g.gross,
    netRevenue: g.net,
    orders: g.orders,
  }));
}

export async function getRevenueTimeseries(
  mentorId: string,
  range: DateRange,
  interval: 'day' | 'month',
) {
  const buckets = await Order.aggregate<{ _id: Date; net: number; orders: number }>([
    { $match: paidMatch(mentorId, range) },
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: interval, timezone: BUCKET_TIMEZONE } },
        net: { $sum: '$finalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return buckets.map((b) => ({
    date: b._id.toISOString(),
    netRevenue: b.net,
    orders: b.orders,
  }));
}

export async function listOrdersForMentor(
  mentorId: string,
  filter: { status?: 'pending' | 'paid' | 'failed'; courseId?: string },
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const query: Record<string, unknown> = { mentorId };
  if (filter.status) query.status = filter.status;
  if (filter.courseId) query.courseId = filter.courseId;

  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({ path: 'studentId', model: User, select: 'name email' })
      .populate({ path: 'courseId', model: Course, select: 'title' })
      .lean<OrderDoc[]>(),
    Order.countDocuments(query),
  ]);
  return { items, total };
}
