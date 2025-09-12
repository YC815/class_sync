import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { weekStart: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { events, eventsToDelete = [] } = await request.json()
    
    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 })
    }

    const weekStart = new Date(params.weekStart)
    const userId = session.user.id

    // Get access token from session (JWT strategy)
    const accessToken = (session as any).accessToken
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Google account not connected or token expired' }, { status: 401 })
    }

    const calendarService = new GoogleCalendarService(accessToken)
    
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

    // Create/update events
    const syncedEvents = []
    
    for (const event of events) {
      try {
        const calendarEvent = calendarService.scheduleEventToCalendarEvent(
          event,
          weekStart,
          event.location
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
      message: `Successfully synced ${syncedEvents.length} events and deleted ${eventsToDelete.length} events`
    })
  } catch (error) {
    console.error('Error syncing to calendar:', error)
    return NextResponse.json({ 
      error: 'Sync failed. Please check your Google Calendar permissions and try again.' 
    }, { status: 500 })
  }
}