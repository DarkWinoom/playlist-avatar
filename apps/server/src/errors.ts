import type { ErrorCode } from '@playlist-avatar/contracts';
import { CONTRACT_VERSION } from '@playlist-avatar/contracts';

export class ServiceError extends Error {
  code: ErrorCode;
  status: 400 | 403 | 404 | 408 | 413 | 422 | 429 | 500 | 501 | 502 | 504;
  retryAfterMs?: number;
  constructor(code: ErrorCode, status: ServiceError['status'] = 502, retryAfterMs?: number) {
    super(code); this.name = 'ServiceError'; this.code = code; this.status = status; this.retryAfterMs = retryAfterMs;
  }
}
export function abortError(signal: AbortSignal) {
  return signal.reason instanceof ServiceError ? signal.reason : new ServiceError('CANCELLED', 408);
}

export function publicError(error: unknown) {
  const failure = error instanceof ServiceError ? error : new ServiceError('INTERNAL_ERROR', 500);
  return { status: failure.status, body: { version: CONTRACT_VERSION, error: { code: failure.code,
    retryable: ['UPSTREAM_TIMEOUT', 'RATE_LIMITED', 'IMAGE_UNAVAILABLE', 'INTERNAL_ERROR'].includes(failure.code),
    ...(failure.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {}) } } };
}
