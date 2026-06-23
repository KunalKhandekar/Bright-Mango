import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getCourseOrThrow } from '../course/course.service.js';
import * as couponService from './coupon.service.js';

export async function create(req: Request, res: Response): Promise<Response> {
  const coupon = await couponService.createCoupon(req.auth!.userId, req.body);
  return ApiResponse.created(res, 'Coupon created', { coupon });
}

export async function update(req: Request, res: Response): Promise<Response> {
  const coupon = await couponService.updateCoupon(req.params.id, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Coupon updated', { coupon });
}

export async function remove(req: Request, res: Response): Promise<Response> {
  await couponService.deleteCoupon(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Coupon deleted');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const coupons = await couponService.listCoupons(req.auth!.userId);
  return ApiResponse.ok(res, 'Coupons', { coupons });
}

/** Student-facing: compute discount for a code against a course (no mutation). */
export async function validateCoupon(req: Request, res: Response): Promise<Response> {
  const course = await getCourseOrThrow(req.body.courseId);
  const applied = await couponService.applyCoupon(req.body.code, req.body.courseId, course.price);
  return ApiResponse.ok(res, 'Coupon valid', {
    discount: applied.discount,
    finalAmount: applied.finalAmount,
    originalAmount: course.price,
  });
}
