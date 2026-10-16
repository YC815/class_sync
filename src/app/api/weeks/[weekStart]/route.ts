import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { WeekSchedule } from '@/lib/types'

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id

    // 從 events 表重建課表（single source of truth）
    const events = await prisma.event.findMany({
      where: { userId, weekStart },
      orderBy: [{ weekday: 'asc' }, { periodStart: 'asc' }]
    })

    const schedule: WeekSchedule = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {} }

    events.forEach(event => {
      for (let period = event.periodStart; period <= event.periodEnd; period++) {
        if (!schedule[event.weekday]) schedule[event.weekday] = {}
        schedule[event.weekday][period] = {
          courseId: event.courseId || undefined,
          courseName: event.courseName || '',
          base: event.baseName || undefined,
          room: event.roomName || undefined,
          location: event.baseName
            ? event.baseName + (event.roomName ? ' - ' + event.roomName : '')
            : undefined,
          address: event.address || undefined,
          calendarEventId: event.calendarEventId || undefined,
        }
      }
    })

    // 確保每天每節都有結構（null 填充）
    const completeSchedule: WeekSchedule = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {} }
    for (let day = 1; day <= 7; day++) {
      completeSchedule[day as keyof WeekSchedule] = schedule[day] || {}
      for (let period = 1; period <= 8; period++) {
        if (completeSchedule[day as keyof WeekSchedule][period] === undefined) {
          completeSchedule[day as keyof WeekSchedule][period] = null
        }
      }
    }

    return NextResponse.json({
      schedule: completeSchedule,
      weekStart: formatDateLocal(weekStart),
      totalEvents: events.length,
    })
  } catch (error) {
    console.error('Error fetching week schedule:', error)
    return NextResponse.json(
      { error: '獲取課表失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
