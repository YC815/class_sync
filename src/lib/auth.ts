import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt'
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email https://www.googleapis.com/auth/calendar',
          access_type: 'offline',
          prompt: 'consent'
        },
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      console.log('SignIn callback:', { user, account: account?.provider, profile: profile?.sub })
      
      if (account?.provider === 'google' && user?.email && profile?.sub) {
        let userAlreadyExists = false
        try {
          // Use Google's sub ID as user ID for consistency
          const userId = profile.sub

          // Check if user exists by email first, then by ID
          let existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          })

          if (!existingUser) {
            existingUser = await prisma.user.findUnique({
              where: { id: userId }
            })
          }

          userAlreadyExists = !!existingUser

          if (!existingUser) {
            // Create new user in database
            await prisma.user.create({
              data: {
                id: userId,
                name: user.name,
                email: user.email,
                image: user.image,
              }
            })
            console.log(`Created new user: ${userId} (${user.email})`)
          } else if (existingUser.id !== userId) {
            // Update user ID if needed (for migration)
            await prisma.user.update({
              where: { email: user.email },
              data: { id: userId }
            })
            console.log(`Updated user ID: ${existingUser.id} -> ${userId} (${user.email})`)
          }

          // Update user ID for the session
          user.id = userId
        } catch (error) {
          console.error('Error managing user:', error)
          if (!userAlreadyExists) {
            return false  // 新用戶建立失敗，阻止登入以避免 FK 錯誤
          }
          // 既有用戶更新失敗，可繼續
        }
      }
      return true
    },
    jwt: async ({ token, account }) => {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        console.log('✅ [Auth] New tokens stored in JWT:', {
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          expiresAt: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : 'N/A'
        })
      }

      // Check if token is expired and refresh if needed
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Token is expired, try to refresh it
      if (token.refreshToken) {
        try {
          console.log('🔄 [Auth] Access token expired, refreshing...')
          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            }),
          })

          if (response.ok) {
            const refreshedTokens = await response.json()
            console.log('✅ [Auth] Token refreshed successfully')

            return {
              ...token,
              accessToken: refreshedTokens.access_token,
              expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
              refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
            }
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.error('❌ [Auth] Failed to refresh token:', response.status, errorData)

            // 如果是 invalid_grant 錯誤，清除 tokens
            if (errorData.error === 'invalid_grant') {
              console.log('❌ [Auth] Refresh token invalid, clearing tokens')
              return {
                ...token,
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                error: 'RefreshAccessTokenError'
              }
            }
          }
        } catch (error) {
          console.error('❌ [Auth] Error refreshing token:', error)
          return {
            ...token,
            error: 'RefreshAccessTokenError'
          }
        }
      }

      return token
    },
    session: async ({ session, token }) => {
      if (session?.user) {
        // Use token.sub as user ID for JWT sessions
        session.user.id = token.sub!

        // 檢查是否有 refresh error
        if (token.error) {
          console.log('❌ [Auth] Session has token error:', token.error)
          // 不要提供 accessToken，讓前端知道需要重新認證
          session.error = token.error as string
        } else if (token?.accessToken) {
          session.accessToken = token.accessToken as string
          session.refreshToken = token.refreshToken as string
          session.expiresAt = token.expiresAt as number
        }

        // Add token expiry info for debugging
        if (token?.expiresAt) {
          const isExpired = Date.now() >= (token.expiresAt as number) * 1000
          console.log('🔑 [Auth] Token status:', {
            hasToken: !!token.accessToken,
            expiresAt: new Date((token.expiresAt as number) * 1000).toISOString(),
            isExpired,
            hasError: !!token.error
          })
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}