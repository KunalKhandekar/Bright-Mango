import { Response } from 'express';
import { HttpStatus } from './httpStatus.js';

/**
 * Normalized success envelope. Every successful controller response is built from this.
 * Wire shape: { success, statusCode, message, data, meta? }
 */
export class ApiResponse<T = unknown> {
  readonly success = true as const;

  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly data: T | null = null,
    public readonly meta?: Record<string, unknown>,
  ) {}

  /** Serialize to JSON and send on the given Express response. */
  send(res: Response): Response {
    const body: Record<string, unknown> = {
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
    };
    if (this.meta !== undefined) body.meta = this.meta;
    return res.status(this.statusCode).json(body);
  }

  static ok<T>(res: Response, message: string, data?: T, meta?: Record<string, unknown>): Response {
    return new ApiResponse(HttpStatus.OK, message, data ?? null, meta).send(res);
  }

  static created<T>(res: Response, message: string, data?: T): Response {
    return new ApiResponse(HttpStatus.CREATED, message, data ?? null).send(res);
  }

  static noContent(res: Response): Response {
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}
