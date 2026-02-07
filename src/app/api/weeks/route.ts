import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const whereClause: { userId: string; weekStart?: { gte: Date; lte: Date } | Date } = { userId: session.user.id }

    if (from && to) {
      whereClause.weekStart = {
        gte: new Date(from),
        lte: new Date(to)
      }
    }

    const weeks = await prisma.week.findMany({
      where: whereClause,
      orderBy: { weekStart: 'asc' }
    })

    return NextResponse.json({ weeks })
  } catch (error) {
    console.error('Error fetching weeks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { weekStart, data } = await request.json()

    if (!weekStart || !data) {
      return NextResponse.json({ error: 'Week start and data are required' }, { status: 400 })
    }

    const userId = session.user.id

    const week = await prisma.week.upsert({
      where: {
        userId_weekStart: {
          userId,
          weekStart: new Date(weekStart)
        }
      },
      create: {
        userId,
        weekStart: new Date(weekStart),
        data
      },
      update: {
        data
      }
    })

    return NextResponse.json({ week })
  } catch (error) {
    console.error('Error updating week:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}