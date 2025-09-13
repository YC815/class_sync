import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'

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
    const calendarEvents = await calendarService.listEvents(weekStart)
    console.log('📅 [SyncDeleted] Found Google Calendar events:', calendarEvents.length)
    
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