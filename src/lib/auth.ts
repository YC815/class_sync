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

      // Check if token is expired
      // Note: Token refresh is handled by ensureGoogleAccess() in API routes
      // to maintain Single Source of Truth and avoid race conditions
      if (token.expiresAt && Date.now() > (token.expiresAt as number) * 1000) {
        // Token is expired
        if (!token.refreshToken) {
          // No refresh token available, mark error for frontend to handle
          console.log('❌ [Auth] Token expired and no refresh token available')
          return {
            ...token,
            error: 'RefreshAccessTokenError'
          }
        }
        
        // Token expired but has refreshToken - let ensureGoogleAccess() handle it
        // This avoids race conditions between JWT callback and API layer
        console.log('⏳ [Auth] Token expired, will be refreshed in API layer via ensureGoogleAccess()')
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