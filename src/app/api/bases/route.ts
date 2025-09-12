import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bases = await prisma.base.findMany({
      where: {
        userId: session.user.id
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

    return NextResponse.json(bases)
  } catch (error) {
    console.error('Failed to fetch bases:', error)
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

    const { name, address, placeId, isSingleRoom, rooms } = await request.json()

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
        placeId,
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
    console.error('Failed to create base:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}