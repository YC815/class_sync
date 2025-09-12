import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const whereClause: any = { userId }
    
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
    const { userId, weekStart, data } = await request.json()
    
    if (!userId || !weekStart || !data) {
      return NextResponse.json({ error: 'User ID, week start, and data are required' }, { status: 400 })
    }

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