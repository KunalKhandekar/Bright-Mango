import { env } from '../config/env.js';
import { ApiError } from '../common/http/ApiError.js';
import { ErrorCode } from '../common/http/errorCodes.js';

const BASE = 'https://api.cloudflare.com/client/v4';

function assertConfigured(): void {
  if (!env.stream.accountId || !env.stream.apiToken) {
    throw new ApiError(
      503,
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Cloudflare Stream is not configured',
    );
  }
}

async function cf<T>(path: string, init: RequestInit): Promise<T> {
  assertConfigured();
  const res = await fetch(`${BASE}/accounts/${env.stream.accountId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.stream.apiToken}`, ...(init.headers ?? {}) },
  });
  const json = (await res.json()) as { success: boolean; result: T; errors?: unknown };
  if (!res.ok || !json.success) {
    throw new ApiError(502, ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Cloudflare Stream request failed', json.errors);
  }
  return json.result;
}

export interface DirectUpload {
  uploadUrl: string;
  uid: string;
}

/** One-time tus/direct upload URL — the browser uploads the video straight to Cloudflare. */
export async function createDirectUpload(maxDurationSeconds = 7200): Promise<DirectUpload> {
  const result = await cf<{ uploadURL: string; uid: string }>('/stream/direct_upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxDurationSeconds, requireSignedURLs: true }),
  });
  return { uploadUrl: result.uploadURL, uid: result.uid };
}

export interface VideoStatus {
  ready: boolean;
  playbackId: string | null;
  durationSeconds: number;
}

export async function getVideoStatus(uid: string): Promise<VideoStatus> {
  const result = await cf<{
    readyToStream: boolean;
    playback?: { hls?: string };
    duration?: number;
    uid: string;
  }>(`/stream/${uid}`, { method: 'GET' });
  return {
    ready: result.readyToStream,
    playbackId: result.readyToStream ? result.uid : null,
    durationSeconds: Math.round(result.duration ?? 0),
  };
}

/** Short-lived signed playback token (video has requireSignedURLs=true). */
export async function getSignedPlaybackToken(uid: string, ttlSeconds = 3600): Promise<string> {
  const result = await cf<{ token: string }>(`/stream/${uid}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  });
  return result.token;
}

export async function deleteVideo(uid: string): Promise<void> {
  await cf(`/stream/${uid}`, { method: 'DELETE' });
}
