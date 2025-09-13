import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { validateScheduleEvent } from '@/lib/schedule-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ [Sync] Unauthorized: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { events, eventsToDelete = [] } = await request.json()
    
    if (!events || !Array.isArray(events)) {
      console.log('❌ [Sync] Invalid request: Events array is required')
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id
    
    console.log('🔄 [Sync] Starting sync for week:', weekStartStr, 'userId:', userId)
    console.log('🔄 [Sync] Events to create/update:', events.length)
    console.log('🔄 [Sync] Events to delete:', eventsToDelete.length)
    console.log('🔄 [Sync] Incoming events details:', events.map(e => ({
      courseName: e.courseName,
      weekday: e.weekday,
      periods: `${e.periodStart}-${e.periodEnd}`,
      location: e.location,
      courseId: e.courseId
    })))

    // Get access token from session (JWT strategy)
    const accessToken = (session as { accessToken?: string }).accessToken
    
    console.log('🔑 [Sync] Session details:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      sessionKeys: Object.keys(session || {}),
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length || 0,
      tokenStart: accessToken?.substring(0, 20) + '...' || 'N/A',
      fullSession: session
    })
    
    if (!accessToken) {
      console.log('❌ [Sync] No access token available')
      console.log('❌ [Sync] Full session object:', JSON.stringify(session, null, 2))
      return NextResponse.json({ error: 'Google account not connected or token expired. Please sign out and sign in again.' }, { status: 401 })
    }

    const calendarService = new GoogleCalendarService(accessToken)
    console.log('✅ [Sync] Google Calendar service initialized')
    
    // 首先清理該週的所有現有事件，避免干擾
    const existingEvents = await prisma.event.findMany({
      where: {
        userId,
        weekStart
      }
    })
    
    console.log('📋 [Sync] Found existing events for this week:', existingEvents.length)
    console.log('📋 [Sync] Existing events details:', existingEvents.map(e => ({
      id: e.id,
      courseName: e.courseName,
      weekday: e.weekday,
      periods: `${e.periodStart}-${e.periodEnd}`,
      calendarEventId: e.calendarEventId
    })))
    
    // Delete events that are no longer in the schedule
    for (const eventId of eventsToDelete) {
  let shouldRemoveFromDb = false
  try {
    await calendarService.deleteEvent(eventId)
    shouldRemoveFromDb = true
    console.log('🗑️ [Sync] Deleted calendar event:', eventId)
  } catch (error: any) {
    const status = error?.code || error?.status || error?.response?.status
    if (status === 404 || status === 410) {
      console.log(`⚠️ [Sync] Event ${eventId} not found in Google (status ${status}), removing from DB`)
      shouldRemoveFromDb = true
    } else if (status === 401) {
      console.warn(`❌ [Sync] Unauthorized while deleting event ${eventId}:`, error)
      return NextResponse.json(
        { error: 'Google Calendar authorization failed. Please sign in again.' },
        { status: 401 }
      )
    } else {
      console.warn(`❗ [Sync] Failed to delete Google event ${eventId}:`, error)
    }
  }

  if (shouldRemoveFromDb) {
    await prisma.event.deleteMany({
      where: { userId, calendarEventId: eventId }
    })
    console.log('🗑️ [Sync] Removed event from database:', eventId)
  }
}

    
    // 清理該週所有在資料庫但不在新事件列表中的事件
    const newEventKeys = new Set(
      events.map((e: { weekday: number; periodStart: number; periodEnd: number; courseId?: string; courseName: string }) => `${e.weekday}-${e.periodStart}-${e.periodEnd}-${e.courseId || e.courseName}`)
    )
    
    for (const existingEvent of existingEvents) {
      const key = `${existingEvent.weekday}-${existingEvent.periodStart}-${existingEvent.periodEnd}-${existingEvent.courseId || existingEvent.courseName}`
      if (!newEventKeys.has(key) && existingEvent.calendarEventId) {
        try {
          await calendarService.deleteEvent(existingEvent.calendarEventId)
          await prisma.event.delete({
            where: { id: existingEvent.id }
          })
          console.log('Cleaned up orphaned event:', key)
        } catch (error) {
          const statusCode = (error as any)?.code || (error as any)?.response?.status
          if (statusCode === 401) {
            console.warn('Unauthorized while cleaning up orphaned event:', error)
            return NextResponse.json(
              { error: 'Google Calendar authorization failed. Please sign in again.' },
              { status: 401 }
            )
          }
          console.warn('Failed to clean up orphaned event:', error)
        }
      }
    }

    // Create/update events
    const syncedEvents = []
    
    for (const event of events) {
      try {
        // 驗證事件資料
        const validationErrors = validateScheduleEvent(event)
        if (validationErrors.length > 0) {
          console.warn('Invalid event data:', event, 'Errors:', validationErrors)
          continue // 跳過無效事件
        }
        
        console.log('🔄 [Sync] Processing event:', {
          weekday: event.weekday,
          periods: `${event.periodStart}-${event.periodEnd}`,
          course: event.courseName || event.courseId,
          location: event.location,
          courseId: event.courseId
        })
        
        // 從資料庫載入課程連結資訊
        let courseLinks: { name: string; url: string }[] = []
        if (event.courseId) {
          const courseWithLinks = await prisma.course.findUnique({
            where: { id: event.courseId },
            include: {
              links: {
                orderBy: {
                  order: 'asc'
                }
              }
            }
          })
          
          if (courseWithLinks?.links) {
            courseLinks = courseWithLinks.links.map(link => ({
              name: link.name,
              url: link.url
            }))
          }
        }
        
        const calendarEvent = calendarService.scheduleEventToCalendarEvent(
          event,
          weekStart,
          courseLinks
        )

        let calendarEventId: string

        // Check if event already exists in database
        const existingEvent = await prisma.event.findFirst({
          where: {
            userId,
            weekStart,
            weekday: event.weekday,
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            courseId: event.courseId || undefined,
            courseName: event.courseName
          }
        })

        if (existingEvent?.calendarEventId) {
          // Update existing event
          console.log('🔄 [Sync] Updating existing event with ID:', existingEvent.calendarEventId)
          await calendarService.updateEvent(existingEvent.calendarEventId, calendarEvent)
          calendarEventId = existingEvent.calendarEventId
          console.log('✅ [Sync] Event updated successfully')
        } else if (existingEvent && !existingEvent.calendarEventId) {
          // Existing event in DB but no Calendar ID - create new calendar event and update DB
          console.log('➕ [Sync] Creating calendar event for existing DB record')
          calendarEventId = await calendarService.createEvent(calendarEvent)
          console.log('✅ [Sync] New calendar event created with ID:', calendarEventId)
        } else {
          // Completely new event
          console.log('➕ [Sync] Creating completely new event')
          calendarEventId = await calendarService.createEvent(calendarEvent)
          console.log('✅ [Sync] New event created with ID:', calendarEventId)
        }

        // Save/update event in database
        console.log('💾 [Sync] Saving event to database:', {
          existingEventId: existingEvent?.id,
          calendarEventId,
          isUpdate: !!existingEvent
        })
        
        const savedEvent = await prisma.event.upsert({
          where: {
            id: existingEvent?.id || 'new-id'
          },
          create: {
            userId,
            weekStart,
            weekday: event.weekday,
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            courseId: event.courseId,
            courseName: event.courseName,
            calendarEventId,
            seriesId: event.seriesId || null
          },
          update: {
            courseName: event.courseName,
            calendarEventId,
            seriesId: event.seriesId || null
          }
        })

        console.log('✅ [Sync] Event saved to database with ID:', savedEvent.id)
        syncedEvents.push(savedEvent)
      } catch (eventError) {
        const statusCode = (eventError as any)?.code || (eventError as any)?.response?.status
        if (statusCode === 401) {
          console.error('❌ [Sync] Unauthorized while syncing event:', eventError)
          return NextResponse.json(
            { error: 'Google Calendar authorization failed. Please sign in again.' },
            { status: 401 }
          )
        }
        console.error('❌ [Sync] Failed to sync event:', {
          event: {
            courseName: event.courseName,
            weekday: event.weekday,
            periods: `${event.periodStart}-${event.periodEnd}`
          },
          error: eventError
        })
        // Continue with other events
      }
    }

    console.log('✅ [Sync] Sync completed successfully:', {
      syncedEvents: syncedEvents.length,
      deletedEvents: eventsToDelete.length,
      totalProcessed: events.length
    })

    return NextResponse.json({ 
      success: true,
      syncedEvents: syncedEvents.length,
      deletedEvents: eventsToDelete.length,
      message: `成功同步 ${syncedEvents.length} 個事件，刪除 ${eventsToDelete.length} 個事件`
    })
  } catch (error) {
    console.error('❌ [Sync] Critical error during sync:', {
      error: error,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({ 
      error: '同步失敗，請檢查 Google Calendar 權限後重試' 
    }, { status: 500 })
  }
}