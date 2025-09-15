interface TokenInfo {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

interface RefreshTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  error?: string
}

export class ReauthRequiredError extends Error {
  constructor(message: string = '需要重新認證 Google 帳戶') {
    super(message)
    this.name = 'ReauthRequiredError'
  }
}

export async function ensureGoogleAccess(tokenInfo: TokenInfo): Promise<string> {
  const { accessToken, refreshToken, expiresAt } = tokenInfo

  if (!refreshToken) {
    console.error('❌ [Auth] No refresh token available')
    throw new ReauthRequiredError('缺少 refresh token，需要重新授權')
  }

  // 檢查 token 是否在 60 秒內過期
  const willExpireSoon = !expiresAt || Date.now() > (expiresAt * 1000) - 60_000

  if (!willExpireSoon) {
    console.log('✅ [Auth] Access token is still valid')
    return accessToken
  }

  console.log('🔄 [Auth] Access token expired or expiring soon, refreshing...')

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ [Auth] Failed to refresh token:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })

      // 檢查是否為 invalid_grant 錯誤
      if (errorData.error === 'invalid_grant' || response.status === 400) {
        throw new ReauthRequiredError('Refresh token 已失效，需要重新授權')
      }

      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
    }

    const refreshedTokens: RefreshTokenResponse = await response.json()
    console.log('✅ [Auth] Token refreshed successfully')

    return refreshedTokens.access_token
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      throw error
    }

    console.error('❌ [Auth] Error refreshing token:', error)
    throw new ReauthRequiredError('Token 刷新失敗，需要重新認證')
  }
}

export async function validateGoogleToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)

    if (!response.ok) {
      console.log('❌ [Auth] Token validation failed:', response.status)
      return false
    }

    const tokenInfo = await response.json()

    // 檢查 token 是否包含需要的 scope
    const requiredScope = 'https://www.googleapis.com/auth/calendar'
    const hasRequiredScope = tokenInfo.scope?.includes(requiredScope)

    if (!hasRequiredScope) {
      console.log('❌ [Auth] Token missing required Calendar scope')
      return false
    }

    console.log('✅ [Auth] Token validation successful')
    return true
  } catch (error) {
    console.error('❌ [Auth] Error validating token:', error)
    return false
  }
}