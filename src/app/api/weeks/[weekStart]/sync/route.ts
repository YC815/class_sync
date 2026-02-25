import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { validateScheduleEvent } from '@/lib/schedule-utils'
import { ensureGoogleAccess, ReauthRequiredError } from '@/lib/google-auth'

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

    // 獲取 session 中的認證資訊
    const sessionWithTokens = session as any
    const accessToken = sessionWithTokens.accessToken
    const refreshToken = sessionWithTokens.refreshToken
    const expiresAt = sessionWithTokens.expiresAt

    console.log('🔑 [Sync] Session details:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      tokenExpiry: expiresAt ? new Date(expiresAt * 1000).toISOString() : 'N/A'
    })

    if (!accessToken) {
      console.log('❌ [Sync] No access token available')
      return NextResponse.json({
        error: 'reauth_required',
        message: 'Google 帳戶未連結或 token 已過期，請重新登入。'
      }, { status: 401 })
    }

    // 確保 Google access token 有效
    let validAccessToken: string
    try {
      validAccessToken = await ensureGoogleAccess({
        accessToken,
        refreshToken,
        expiresAt
      }, userId)
      console.log('✅ [Sync] Google access token validated')
    } catch (error) {
      console.error('❌ [Sync] Token validation/refresh failed:', error)

      if (error instanceof ReauthRequiredError) {
        return NextResponse.json({
          error: 'reauth_required',
          message: error.message
        }, { status: 401 })
      }

      return NextResponse.json({
        error: 'auth_error',
        message: '認證檢查失敗，請稍後重試。'
      }, { status: 500 })
    }

    const calendarService = new GoogleCalendarService(validAccessToken)
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
      return NextResponse.json({
        error: 'reauth_required',
        message: 'Google Calendar 授權失敗，請重新登入。'
      }, { status: 401 })
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


    // 註解：移除過度清理邏輯，避免誤刪既有課程
    // 現在只處理明確標記在 eventsToDelete 中的事件
    console.log('ℹ️ [Sync] Skipping automatic cleanup of existing events to preserve unchanged courses')

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
        
        const calendarEvent = calendarService.scheduleEventToCalendarEvent(
          event,
          weekStart
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

        // Parse location information for database storage
        const locationStr = event.location || ''
        let baseName = ''
        let roomName = ''

        // Parse location string to extract base and room names
        // Expected format: "baseName - roomName" or "baseName" or "roomName"
        if (locationStr.includes(' - ')) {
          const parts = locationStr.split(' - ')
          baseName = parts[0].trim()
          roomName = parts[1].trim()
        } else if (locationStr) {
          // If no separator, treat as baseName by default
          baseName = locationStr.trim()
        }

        // Save/update event in database
        console.log('💾 [Sync] Saving event to database:', {
          existingEventId: existingEvent?.id,
          calendarEventId,
          isUpdate: !!existingEvent,
          location: locationStr,
          baseName,
          roomName
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
            baseName: baseName || null,
            roomName: roomName || null,
            calendarEventId,
            seriesId: event.seriesId || null
          },
          update: {
            courseName: event.courseName,
            baseName: baseName || null,
            roomName: roomName || null,
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
          return NextResponse.json({
            error: 'reauth_required',
            message: 'Google Calendar 授權失敗，請重新登入。'
          }, { status: 401 })
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