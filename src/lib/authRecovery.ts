import { errorText } from './errors'
import { supabase } from './supabase'

/**
 * PostgREST can briefly reject a freshly issued access token when its clock is
 * behind the Auth service clock. Keep the workaround deliberately short so a
 * normal request never incurs an extra delay or request.
 */
export const JWT_FUTURE_RETRY_DELAY_MS = 1000

export function isJwtIssuedAtFutureError(error: unknown) {
  const message = errorText(error).toLowerCase()
  return message.includes('jwt issued at future')
    || message.includes('jwtissuedatfuture')
    || (message.includes('pgrst303') && message.includes('future'))
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

/**
 * Retries one failed data operation after obtaining a fresh Supabase session.
 * It is intentionally limited to the intermittent JWT clock-skew error.
 */
export async function withAuthRecovery<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isJwtIssuedAtFutureError(error)) throw error

    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw error

    await wait(JWT_FUTURE_RETRY_DELAY_MS)
    return operation()
  }
}
