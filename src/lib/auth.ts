import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email https://www.googleapis.com/auth/calendar'
        },
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, account }) => {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },
    session: async ({ session, token, user }) => {
      if (session?.user) {
        // When using database sessions, user.id comes from the database
        // When using JWT sessions, we need to use token.sub
        session.user.id = user?.id || token.sub!
        if (token?.accessToken) {
          session.accessToken = token.accessToken
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}