import { refreshAccessToken } from '@/lib/auth'
import { getSetting, updateSetting } from '@/lib/dal'

/**
 * Retrieve stored Google OAuth credentials from settings.
 * Throws if the integration has not been connected yet or the stored value is malformed.
 */
export const getGoogleCredentials = async (): Promise<{
  access_token: string
  refresh_token?: string
  expires_at?: number
}> => {
  const credentialsStr = await getSetting('integrations_google_credentials')
  if (!credentialsStr) throw new Error('Google integration not connected')

  try {
    return JSON.parse(credentialsStr)
  } catch {
    throw new Error('Invalid Google credentials')
  }
}

/**
 * Ensure that we have a valid Google OAuth access token, refreshing it if necessary.
 * If the token is refreshed, the stored credentials are updated automatically.
 */
export const ensureValidGoogleToken = async (credentials: {
  access_token: string
  refresh_token?: string
  expires_at?: number
}): Promise<string> => {
  const now = Date.now()
  // If the token is still valid for at least 1 minute, reuse it
  if (credentials.expires_at && credentials.expires_at - 60_000 > now) {
    return credentials.access_token
  }

  if (!credentials.refresh_token) throw new Error('Access token expired and no refresh token available')

  const newTokens = await refreshAccessToken('google', credentials.refresh_token)

  const updated = {
    ...credentials,
    access_token: newTokens.access_token,
    expires_at: Date.now() + newTokens.expires_in * 1000,
  }

  await updateSetting('integrations_google_credentials', JSON.stringify(updated))

  return updated.access_token
}
