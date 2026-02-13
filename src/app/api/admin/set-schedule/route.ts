import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { validateScheduleData } from '@/lib/schedule-utils'
import { writeScheduleAsEvents } from '@/lib/schedule-writer'
import type { WeekSchedule } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { apiKey, userId, weekStart, data } = await request.json()

    // Validate API key
    const expectedKey = process.env.ADMIN_API_KEY
    if (!expectedKey || !apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const a = Buffer.from(apiKey)
    const b = Buffer.from(expectedKey)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!weekStart || typeof weekStart !== 'string') {
      return NextResponse.json({ error: 'weekStart is required (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'data is required' }, { status: 400 })
    }

    // Validate userId exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validate schedule structure
    const errors = validateScheduleData(data as WeekSchedule)
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Invalid schedule data', errors }, { status: 400 })
    }

    // 使用新的統一寫入邏輯：將 WeekSchedule 寫入 events 表
    const result = await writeScheduleAsEvents(
      userId,
      new Date(weekStart),
      data as WeekSchedule,
      prisma
    )

    console.log(`[Admin API] Successfully wrote schedule for week ${weekStart}: ${result.eventsCreated} events created`)

    return NextResponse.json({
      success: true,
      weekStart,
      eventsCreated: result.eventsCreated
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
