import axios, { AxiosError, type AxiosResponse } from 'axios'
import { env } from '@/lib/env'
import { ApiError, type Envelope, type ErrorEnvelope, type Meta } from '@/types/api'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Don't clear auth state on 401 (auth bootstrap / login endpoints) */
    skipAuthRedirect?: boolean
  }
}

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorEnvelope>) => {
    if (!error.response) {
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.')
    }
    const body = error.response.data
    const apiError = new ApiError(
      body?.statusCode ?? error.response.status,
      (body?.errorCode as ApiError['errorCode']) ?? 'INTERNAL_ERROR',
      body?.message ?? 'Something went wrong',
      body?.details,
    )
    if (apiError.errorCode === 'UNAUTHENTICATED' && !error.config?.skipAuthRedirect) {
      // Clear auth state; route guards react and redirect to /login.
      // Imported lazily to avoid a circular dependency at module init.
      const { useAuthStore } = await import('@/stores/auth.store')
      useAuthStore.getState().clearUser()
    }
    throw apiError
  },
)

/**
 * Unwrap the backend envelope: resolves to `data` merged with `meta`
 * (when present), e.g. `{ courses: [...], meta: {...} }`.
 */
export async function unwrap<T extends object>(
  promise: Promise<AxiosResponse<Envelope<T>>>,
): Promise<T & { meta?: Meta }> {
  const res = await promise
  return { ...res.data.data, meta: res.data.meta }
}
