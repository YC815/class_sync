import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { mergeAdjacentPeriods } from '@/lib/schedule-utils'
import { ScheduleEvent } from '@/lib/types'

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ [Preview] Unauthorized: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { scheduleData, currentLocation } = await request.json()
    
    console.log('🔍 [Preview] Received request data:', {
      scheduleData: scheduleData ? 'Present' : 'Missing',
      currentLocation,
      scheduleDataKeys: scheduleData ? Object.keys(scheduleData) : [],
      weekStartStr
    })
    
    if (!scheduleData) {
      console.log('❌ [Preview] Missing schedule data')
      return NextResponse.json({ error: 'Schedule data is required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id
    
    console.log('🔍 [Preview] Previewing changes for week:', weekStartStr, 'userId:', userId)
    
    // Get existing events for this week from database
    const existingEvents = await prisma.event.findMany({
      where: {
        userId,
        weekStart
      }
    })
    
    console.log('📋 [Preview] Found existing events:', existingEvents.length)
    console.log('📋 [Preview] Existing events details:', existingEvents.map(e => ({
      id: e.id,
      courseName: e.courseName,
      weekday: e.weekday,
      periods: `${e.periodStart}-${e.periodEnd}`,
      calendarEventId: e.calendarEventId
    })))

    // Parse schedule data into individual period events
    const newEvents: ScheduleEvent[] = []
    
    console.log('🔄 [Preview] Parsing schedule data into events')
    
    Object.keys(scheduleData).forEach(day => {
      const dayNum = parseInt(day) // 1-5 for Monday-Friday
      if (dayNum >= 1 && dayNum <= 5) {
        console.log(`🔄 [Preview] Processing day ${dayNum}:`, scheduleData[day])
        
        Object.keys(scheduleData[day]).forEach(period => {
          const periodNum = parseInt(period) // 1-8 for periods
          if (periodNum >= 1 && periodNum <= 8) {
            const cellData = scheduleData[day][period]
            
            console.log(`🔄 [Preview] Day ${dayNum}, Period ${periodNum}:`, cellData)
            
            if (cellData && (cellData.courseId || cellData.courseName)) {
              const newEvent = {
                weekday: dayNum,
                periodStart: periodNum,
                periodEnd: periodNum,
                courseId: cellData.courseId,
                courseName: cellData.courseName || cellData.courseId,
                location: cellData.location || currentLocation,
                url: cellData.url
              }
              
              console.log(`➕ [Preview] Adding event:`, newEvent)
              newEvents.push(newEvent)
            }
          }
        })
      }
    })
    
    console.log('🔄 [Preview] Total new events before merging:', newEvents.length)

    // Merge adjacent periods for same course
    const mergedEvents = mergeAdjacentPeriods(newEvents)
    
    console.log('🔄 [Preview] Events after merging:', mergedEvents.length)
    console.log('🔄 [Preview] Merged events details:', mergedEvents.map(e => ({
      courseName: e.courseName,
      weekday: e.weekday,
      periods: `${e.periodStart}-${e.periodEnd}`,
      location: e.location,
      courseId: e.courseId
    })))

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
    console.log('🔍 [Preview] Analyzing changes - checking for creates and updates')
    
    mergedEvents.forEach(newEvent => {
      const key = `${newEvent.weekday}-${newEvent.periodStart}-${newEvent.periodEnd}-${newEvent.courseId || newEvent.courseName}`
      console.log(`🔍 [Preview] Checking new event key: ${key}`)
      
      if (!existingEventsMap.has(key)) {
        console.log(`➕ [Preview] Event to CREATE: ${key}`)
        changes.create.push(newEvent)
      } else {
        // Check if event needs updating (location, url, etc.)
        const existing = existingEventsMap.get(key)!
        console.log(`🔄 [Preview] Existing event found, checking for updates:`, {
          existing: {
            courseName: existing.courseName,
            courseId: existing.courseId
          },
          new: {
            courseName: newEvent.courseName,
            courseId: newEvent.courseId
          }
        })
        
        if (
          existing.courseName !== newEvent.courseName ||
          existing.courseId !== newEvent.courseId
        ) {
          console.log(`🔄 [Preview] Event to UPDATE: ${key}`)
          changes.update.push(newEvent)
        } else {
          console.log(`✅ [Preview] No changes needed for: ${key}`)
        }
      }
    })

    // Find events to delete
    console.log('🔍 [Preview] Checking for events to delete')
    
    existingEvents.forEach(existingEvent => {
      const key = `${existingEvent.weekday}-${existingEvent.periodStart}-${existingEvent.periodEnd}-${existingEvent.courseId || existingEvent.courseName}`
      console.log(`🔍 [Preview] Checking existing event key: ${key}`)
      
      if (!newEventsMap.has(key)) {
        const deleteId = existingEvent.calendarEventId || existingEvent.id
        console.log(`🗑️ [Preview] Event to DELETE: ${key} (ID: ${deleteId})`)
        changes.delete.push(deleteId)
      } else {
        console.log(`✅ [Preview] Existing event still present: ${key}`)
      }
    })

    const totalChanges = changes.create.length + changes.update.length + changes.delete.length
    
    console.log('✅ [Preview] Preview complete:', {
      create: changes.create.length,
      update: changes.update.length,
      delete: changes.delete.length,
      totalChanges
    })
    
    return NextResponse.json({ 
      changes,
      weekStart: formatDateLocal(weekStart),
      totalChanges
    })
  } catch (error) {
    console.error('❌ [Preview] Error generating preview:', {
      error: error,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({ error: '預覽失敗，請重試' }, { status: 500 })
  }
}