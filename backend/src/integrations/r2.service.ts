import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { ApiError } from '../common/http/ApiError.js';
import { ErrorCode } from '../common/http/errorCodes.js';

const UPLOAD_TTL_SECONDS = 600; // 10 min to start an upload
const DOWNLOAD_TTL_SECONDS = 300; // 5 min download links

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!env.r2.accountId || !env.r2.accessKeyId || !env.r2.secretAccessKey) {
    throw new ApiError(503, ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Cloudflare R2 is not configured');
  }
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });
  return client;
}

/** Presigned PUT URL — the browser uploads the file directly to R2. */
export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: env.r2.bucket, Key: key, ContentType: contentType });
  return getSignedUrl(getClient(), cmd, { expiresIn: UPLOAD_TTL_SECONDS });
}

/** Short-lived presigned GET URL with a friendly download filename. */
export async function getPresignedDownloadUrl(key: string, filename?: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: env.r2.bucket,
    Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: DOWNLOAD_TTL_SECONDS });
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: env.r2.bucket, Key: key }));
}
