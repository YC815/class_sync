import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'

// Enhanced matching algorithm for linking database events with calendar events
function findMatchingCalendarEvent(dbEvent: any, calendarEvents: any[], weekStart: Date) {
  const candidateEvents = calendarEvents.filter(calEvent => {
    // First check: Must have our app's metadata
    const hasAppMetadata = calEvent.extendedProperties?.private?.source === 'class_sync'
    if (!hasAppMetadata) return false

    // Second check: Match by metadata if available (most reliable)
    const metadata = calEvent.extendedProperties.private
    if (metadata.weekday && metadata.periodStart && metadata.periodEnd) {
      const metadataMatch = (
        parseInt(metadata.weekday) === dbEvent.weekday &&
        parseInt(metadata.periodStart) === dbEvent.periodStart &&
        parseInt(metadata.periodEnd) === dbEvent.periodEnd &&
        metadata.weekStart === weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      )
      if (metadataMatch) return true
    }

    // Third check: Match by time and name (fallback)
    const calEventStart = calEvent.start?.dateTime ? new Date(calEvent.start.dateTime) : null
    const calEventEnd = calEvent.end?.dateTime ? new Date(calEvent.end.dateTime) : null

    if (!calEventStart || !calEventEnd) return false

    // Calculate expected start time
    const expectedStart = new Date(weekStart)
    expectedStart.setDate(expectedStart.getDate() + (dbEvent.weekday - 1))

    const startTime = dbEvent.periodStart === 1 ? 825 :
                     dbEvent.periodStart === 2 ? 920 :
                     dbEvent.periodStart === 3 ? 1015 :
                     dbEvent.periodStart === 4 ? 1110 :
                     dbEvent.periodStart === 5 ? 1315 :
                     dbEvent.periodStart === 6 ? 1410 :
                     dbEvent.periodStart === 7 ? 1505 :
                     dbEvent.periodStart === 8 ? 1600 : 825

    expectedStart.setHours(Math.floor(startTime / 100), startTime % 100, 0, 0)

    // Check time match (within 30 minutes tolerance) and name match
    const timeDiff = Math.abs(calEventStart.getTime() - expectedStart.getTime())
    const summaryMatch = calEvent.summary === dbEvent.courseName

    return timeDiff <= 1800000 && summaryMatch // 30 minutes tolerance
  })

  // Return the best match (prioritize metadata matches)
  const metadataMatch = candidateEvents.find(calEvent => {
    const metadata = calEvent.extendedProperties?.private
    return metadata?.weekday &&
           parseInt(metadata.weekday) === dbEvent.weekday &&
           parseInt(metadata.periodStart) === dbEvent.periodStart
  })

  return metadataMatch || candidateEvents[0] || null
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
      console.log('❌ [SyncDeleted] Unauthorized: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id
    
    console.log('🔄 [SyncDeleted] Starting sync for deleted events for week:', weekStartStr, 'userId:', userId)

    // Get access token from session
    const accessToken = (session as { accessToken?: string }).accessToken
    
    if (!accessToken) {
      console.log('❌ [SyncDeleted] No access token available')
      return NextResponse.json({ error: 'Google account not connected or token expired. Please sign out and sign in again.' }, { status: 401 })
    }

    const calendarService = new GoogleCalendarService(accessToken)
    console.log('✅ [SyncDeleted] Google Calendar service initialized')
    
    // Get all events from database for this week
    const dbEvents = await prisma.event.findMany({
      where: {
        userId,
        weekStart
      }
    })
    
    console.log('📋 [SyncDeleted] Found database events for this week:', dbEvents.length)
    
    // Get all events from Google Calendar for this week
    let calendarEvents: any[] = []
    try {
      calendarEvents = await calendarService.listEvents(weekStart)
      console.log('📅 [SyncDeleted] Found Google Calendar events:', calendarEvents.length)
    } catch (error: any) {
      console.error('❌ [SyncDeleted] Failed to fetch Google Calendar events:', error.message)
      
      // Handle specific OAuth/authentication errors
      if (error.status === 401 || error.code === 401) {
        console.log('🔑 [SyncDeleted] OAuth token expired or invalid')
        return NextResponse.json({ 
          error: 'Google Calendar access expired. Please sign out and sign in again to refresh your permissions.',
          code: 'TOKEN_EXPIRED'
        }, { status: 401 })
      }
      
      // For other errors, still try to clean up database but skip Google Calendar sync
      console.log('⚠️ [SyncDeleted] Continuing with database cleanup only')
      calendarEvents = []
    }
    
    // Create a set of calendar event IDs that exist in Google Calendar
    const existingCalendarEventIds = new Set(
      calendarEvents
        .filter(event => event.id)
        .map(event => event.id!)
    )
    
    console.log('📅 [SyncDeleted] Existing calendar event IDs:', Array.from(existingCalendarEventIds))
    
    // Find database events that no longer exist in Google Calendar
    const eventsToDelete = dbEvents.filter(dbEvent => 
      dbEvent.calendarEventId && !existingCalendarEventIds.has(dbEvent.calendarEventId)
    )
    
    // Also find events that have no calendarEventId but might be duplicates
    const eventsWithoutCalendarId = dbEvents.filter(dbEvent => !dbEvent.calendarEventId)
    
    console.log('🔍 [SyncDeleted] Events without Calendar ID:', eventsWithoutCalendarId.length)
    
    // For events without calendarEventId, check if similar events exist in Google Calendar
    for (const dbEvent of eventsWithoutCalendarId) {
      const matchingCalEvent = findMatchingCalendarEvent(dbEvent, calendarEvents, weekStart)

      if (matchingCalEvent) {
        // Update database with the calendar event ID
        await prisma.event.update({
          where: { id: dbEvent.id },
          data: { calendarEventId: matchingCalEvent.id }
        })
        console.log(`✅ [SyncDeleted] Linked DB event ${dbEvent.id} with Calendar event ${matchingCalEvent.id}`)
      }
    }
    
    console.log('🗑️ [SyncDeleted] Events to delete from database:', eventsToDelete.length)
    console.log('🗑️ [SyncDeleted] Events to delete details:', eventsToDelete.map(e => ({
      id: e.id,
      courseName: e.courseName,
      weekday: e.weekday,
      periods: `${e.periodStart}-${e.periodEnd}`,
      calendarEventId: e.calendarEventId
    })))
    
    // Delete orphaned events from database
    const deletedEventIds: string[] = []
    for (const eventToDelete of eventsToDelete) {
      try {
        await prisma.event.delete({
          where: { id: eventToDelete.id }
        })
        deletedEventIds.push(eventToDelete.id)
        console.log('✅ [SyncDeleted] Deleted database event:', eventToDelete.id)
      } catch (error) {
        console.error('❌ [SyncDeleted] Failed to delete database event:', eventToDelete.id, error)
      }
    }

    // weeks.data 已移除，不再需要更新它（events 表是唯一真相來源）

    console.log('✅ [SyncDeleted] Sync completed successfully:', {
      deletedFromDb: deletedEventIds.length,
      totalProcessed: dbEvents.length
    })

    return NextResponse.json({ 
      success: true,
      deletedFromDb: deletedEventIds.length,
      totalDbEvents: dbEvents.length,
      totalCalendarEvents: calendarEvents.length,
      message: deletedEventIds.length > 0 
        ? `已清理 ${deletedEventIds.length} 個在 Google Calendar 中已刪除的事件`
        : '所有事件都已同步，無需清理'
    })
  } catch (error) {
    console.error('❌ [SyncDeleted] Critical error during sync:', {
      error: error,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({ 
      error: '同步失敗，請檢查 Google Calendar 權限後重試' 
    }, { status: 500 })
  }
}