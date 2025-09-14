import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { initializeUserDefaults } from '@/lib/user-init'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check current bases count before initialization
    const currentBasesCount = await prisma.base.count({
      where: { userId }
    })

    // 為新用戶初始化預設基地和教室
    const userInfo = {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image
    }
    const initSuccess = await initializeUserDefaults(userId, userInfo)
    

    const bases = await prisma.base.findMany({
      where: {
        userId: userId
      },
      include: {
        rooms: {
          orderBy: {
            name: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(bases, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, address, isSingleRoom, rooms } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const base = await prisma.base.create({
      data: {
        name,
        address,
        isSingleRoom: isSingleRoom || false,
        userId: session.user.id,
        rooms: (!isSingleRoom && rooms && rooms.length > 0) ? {
          create: rooms.map((roomName: string) => ({
            name: roomName,
            userId: session.user.id
          }))
        } : undefined
      },
      include: {
        rooms: {
          orderBy: {
            name: 'asc'
          }
        }
      }
    })

    return NextResponse.json(base, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
