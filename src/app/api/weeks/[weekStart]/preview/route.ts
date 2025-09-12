import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { mergeAdjacentPeriods } from '@/lib/schedule-utils'
import { ScheduleEvent } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> | { weekStart: string } }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { scheduleData, currentLocation } = await request.json()
    
    if (!scheduleData) {
      return NextResponse.json({ error: 'Schedule data is required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id
    
    console.log('Previewing changes for week:', weekStartStr, 'userId:', userId)
    
    // Get existing events for this week from database
    const existingEvents = await prisma.event.findMany({
      where: {
        userId,
        weekStart
      }
    })

    // Parse schedule data into individual period events
    const newEvents: ScheduleEvent[] = []
    
    Object.keys(scheduleData).forEach(day => {
      const dayNum = parseInt(day) // 1-5 for Monday-Friday
      if (dayNum >= 1 && dayNum <= 5) {
        Object.keys(scheduleData[day]).forEach(period => {
          const periodNum = parseInt(period) // 1-8 for periods
          if (periodNum >= 1 && periodNum <= 8) {
            const cellData = scheduleData[day][period]
            
            if (cellData && (cellData.courseId || cellData.courseName)) {
              newEvents.push({
                weekday: dayNum,
                periodStart: periodNum,
                periodEnd: periodNum,
                courseId: cellData.courseId,
                courseName: cellData.courseName || cellData.courseId,
                location: cellData.location || currentLocation,
                url: cellData.url
              })
            }
          }
        })
      }
    })

    // Merge adjacent periods for same course
    const mergedEvents = mergeAdjacentPeriods(newEvents)

    // Compare with existing events to determine changes
    const changes = {
      create: [] as ScheduleEvent[],
      update: [] as ScheduleEvent[],
      delete: [] as string[]
    }

    // Create maps for easier comparison
    const existingEventsMap = new Map(
      existingEvents.map(e => [
        `${e.weekday}-${e.periodStart}-${e.periodEnd}-${e.courseId || e.courseName}`,
        e
      ])
    )

    const newEventsMap = new Map(
      mergedEvents.map(e => [
        `${e.weekday}-${e.periodStart}-${e.periodEnd}-${e.courseId || e.courseName}`,
        e
      ])
    )

    // Find events to create
    mergedEvents.forEach(newEvent => {
      const key = `${newEvent.weekday}-${newEvent.periodStart}-${newEvent.periodEnd}-${newEvent.courseId || newEvent.courseName}`
      if (!existingEventsMap.has(key)) {
        changes.create.push(newEvent)
      } else {
        // Check if event needs updating (location, url, etc.)
        const existing = existingEventsMap.get(key)!
        if (
          existing.courseName !== newEvent.courseName ||
          existing.courseId !== newEvent.courseId
        ) {
          changes.update.push(newEvent)
        }
      }
    })

    // Find events to delete
    existingEvents.forEach(existingEvent => {
      const key = `${existingEvent.weekday}-${existingEvent.periodStart}-${existingEvent.periodEnd}-${existingEvent.courseId || existingEvent.courseName}`
      if (!newEventsMap.has(key)) {
        changes.delete.push(existingEvent.calendarEventId || existingEvent.id)
      }
    })

    return NextResponse.json({ 
      changes,
      weekStart: weekStart.toISOString().split('T')[0],
      totalChanges: changes.create.length + changes.update.length + changes.delete.length
    })
  } catch (error) {
    console.error('Error generating preview:', error)
    return NextResponse.json({ error: '預覽失敗，請重試' }, { status: 500 })
  }
}