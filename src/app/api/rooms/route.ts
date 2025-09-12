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

    const rooms = await prisma.room.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        base: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(rooms)
  } catch (error) {
    console.error('Failed to fetch rooms:', error)
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

    const { name, baseId } = await request.json()

    if (!name || !baseId) {
      return NextResponse.json(
        { error: 'Name and baseId are required' },
        { status: 400 }
      )
    }

    // Verify base ownership
    const base = await prisma.base.findFirst({
      where: {
        id: baseId,
        userId: session.user.id
      }
    })

    if (!base) {
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      )
    }

    const room = await prisma.room.create({
      data: {
        name,
        baseId,
        userId: session.user.id
      },
      include: {
        base: true
      }
    })

    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error('Failed to create room:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}