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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { events, eventsToDelete = [] } = await request.json()
    
    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id
    
    console.log('Syncing events for week:', weekStartStr, 'userId:', userId)
    console.log('Events to create/update:', events.length)
    console.log('Events to delete:', eventsToDelete.length)

    // Get access token from session (JWT strategy)
    const accessToken = (session as { accessToken?: string }).accessToken
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Google account not connected or token expired' }, { status: 401 })
    }

    const calendarService = new GoogleCalendarService(accessToken)
    
    // 首先清理該週的所有現有事件，避免干擾
    const existingEvents = await prisma.event.findMany({
      where: {
        userId,
        weekStart
      }
    })
    
    console.log('Found existing events for this week:', existingEvents.length)
    
    // Delete events that are no longer in the schedule
    for (const eventId of eventsToDelete) {
      try {
        await calendarService.deleteEvent(eventId)
        
        // Remove from database
        await prisma.event.deleteMany({
          where: {
            userId,
            calendarEventId: eventId
          }
        })
      } catch (error) {
        console.warn(`Failed to delete event ${eventId}:`, error)
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
        
        console.log('Processing event:', {
          weekday: event.weekday,
          periods: `${event.periodStart}-${event.periodEnd}`,
          course: event.courseName || event.courseId
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
          await calendarService.updateEvent(existingEvent.calendarEventId, calendarEvent)
          calendarEventId = existingEvent.calendarEventId
        } else {
          // Create new event
          calendarEventId = await calendarService.createEvent(calendarEvent)
        }

        // Save/update event in database
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

        syncedEvents.push(savedEvent)
      } catch (eventError) {
        console.error(`Failed to sync event:`, eventError)
        // Continue with other events
      }
    }

    return NextResponse.json({ 
      success: true,
      syncedEvents: syncedEvents.length,
      deletedEvents: eventsToDelete.length,
      message: `成功同步 ${syncedEvents.length} 個事件，刪除 ${eventsToDelete.length} 個事件`
    })
  } catch (error) {
    console.error('Error syncing to calendar:', error)
    return NextResponse.json({ 
      error: '同步失敗，請檢查 Google Calendar 權限後重試' 
    }, { status: 500 })
  }
}