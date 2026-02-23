import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { ensureGoogleAccess, ReauthRequiredError } from '@/lib/google-auth'
import { getWeekStart } from '@/lib/schedule-utils'
import { ScheduleEvent } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ [ForceSyncAll] Unauthorized: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionWithTokens = session as any
    const accessToken = sessionWithTokens.accessToken
    const refreshToken = sessionWithTokens.refreshToken
    const expiresAt = sessionWithTokens.expiresAt

    if (!accessToken) {
      console.log('❌ [ForceSyncAll] No access token available')
      return NextResponse.json({
        error: 'reauth_required',
        message: 'Google 帳戶未連結或 token 已過期，請重新登入。'
      }, { status: 401 })
    }

    let validAccessToken: string
    try {
      validAccessToken = await ensureGoogleAccess({ accessToken, refreshToken, expiresAt })
      console.log('✅ [ForceSyncAll] Google access token validated')
    } catch (error) {
      console.error('❌ [ForceSyncAll] Token validation/refresh failed:', error)
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

    const userId = session.user.id
    const calendarService = new GoogleCalendarService(validAccessToken)

    // Calculate today's week start
    const todayWeekStart = getWeekStart(new Date())
    console.log(`🔄 [ForceSyncAll] Today's week start: ${todayWeekStart.toISOString()}`)

    // Query all events from today's week onwards
    const allEvents = await prisma.event.findMany({
      where: { userId, weekStart: { gte: todayWeekStart } }
    })

    console.log(`🔄 [ForceSyncAll] Found ${allEvents.length} events from today onwards`)

    if (allEvents.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        created: 0,
        errors: 0,
        message: '今天以後沒有任何事件需要同步'
      })
    }

    // Group by weekStart
    const byWeek = new Map<number, { weekStart: Date; events: typeof allEvents }>()
    for (const event of allEvents) {
      const key = event.weekStart.getTime()
      if (!byWeek.has(key)) {
        byWeek.set(key, { weekStart: event.weekStart, events: [] })
      }
      byWeek.get(key)!.events.push(event)
    }

    // Step 1: Delete all Calendar events for each week
    let deleted = 0
    for (const { weekStart } of byWeek.values()) {
      console.log(`🗑️ [ForceSyncAll] Deleting Calendar events for week: ${weekStart.toISOString()}`)
      try {
        const calendarEvents = await calendarService.listEvents(weekStart)
        for (const calEvent of calendarEvents) {
          if (!calEvent.id) continue
          try {
            await calendarService.deleteEvent(calEvent.id)
            deleted++
          } catch (err: any) {
            const status = err?.code || err?.status || err?.response?.status
            if (status === 404 || status === 410) continue // already gone
            console.warn(`⚠️ [ForceSyncAll] Failed to delete Calendar event ${calEvent.id}:`, err)
          }
        }
      } catch (err: any) {
        const status = err?.code || err?.status || err?.response?.status
        if (status === 401) {
          return NextResponse.json({
            error: 'reauth_required',
            message: 'Google Calendar 授權失敗，請重新登入。'
          }, { status: 401 })
        }
        console.error(`❌ [ForceSyncAll] Failed to list events for week ${weekStart.toISOString()}:`, err)
      }
    }

    console.log(`🗑️ [ForceSyncAll] Deleted ${deleted} Calendar events`)

    // Step 2: Clear all calendarEventId in DB
    await prisma.event.updateMany({
      where: { userId, weekStart: { gte: todayWeekStart } },
      data: { calendarEventId: null }
    })
    console.log('✅ [ForceSyncAll] Cleared all calendarEventId in DB')

    // Step 3: Re-query events (all calendarEventId are now null) and create Calendar events
    const eventsToCreate = await prisma.event.findMany({
      where: { userId, weekStart: { gte: todayWeekStart } }
    })

    let created = 0
    let errors = 0

    // Group again for weekStart access
    const byWeekForCreate = new Map<number, { weekStart: Date; events: typeof eventsToCreate }>()
    for (const event of eventsToCreate) {
      const key = event.weekStart.getTime()
      if (!byWeekForCreate.has(key)) {
        byWeekForCreate.set(key, { weekStart: event.weekStart, events: [] })
      }
      byWeekForCreate.get(key)!.events.push(event)
    }

    for (const { weekStart, events } of byWeekForCreate.values()) {
      console.log(`➕ [ForceSyncAll] Creating Calendar events for week: ${weekStart.toISOString()}, count: ${events.length}`)

      for (const event of events) {
        try {
          // Reconstruct location from baseName/roomName
          let location = ''
          if (event.baseName && event.roomName) {
            location = `${event.baseName} - ${event.roomName}`
          } else if (event.baseName) {
            location = event.baseName
          } else if (event.roomName) {
            location = event.roomName
          }

          // Load courseLinks if courseId exists
          let courseLinks: { name: string; url: string }[] = []
          if (event.courseId) {
            const courseWithLinks = await prisma.course.findUnique({
              where: { id: event.courseId },
              include: { links: { orderBy: { order: 'asc' } } }
            })
            if (courseWithLinks?.links) {
              courseLinks = courseWithLinks.links.map(link => ({
                name: link.name,
                url: link.url
              }))
            }
          }

          const scheduleEvent: ScheduleEvent = {
            weekday: event.weekday,
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            courseId: event.courseId || undefined,
            courseName: event.courseName ?? '',
            location: location || undefined,
            seriesId: event.seriesId || undefined,
          }

          const calendarPayload = calendarService.scheduleEventToCalendarEvent(
            scheduleEvent,
            weekStart,
            courseLinks
          )

          const newCalendarEventId = await calendarService.createEvent(calendarPayload)
          await prisma.event.update({
            where: { id: event.id },
            data: { calendarEventId: newCalendarEventId }
          })
          created++
        } catch (eventError: any) {
          const statusCode = eventError?.code || eventError?.response?.status
          if (statusCode === 401) {
            console.error('❌ [ForceSyncAll] Unauthorized while creating event:', eventError)
            return NextResponse.json({
              error: 'reauth_required',
              message: 'Google Calendar 授權失敗，請重新登入。'
            }, { status: 401 })
          }
          console.error('❌ [ForceSyncAll] Failed to create event:', {
            eventId: event.id,
            courseName: event.courseName,
            weekday: event.weekday,
            periods: `${event.periodStart}-${event.periodEnd}`,
            error: eventError
          })
          errors++
        }
      }
    }

    console.log(`✅ [ForceSyncAll] Done — deleted: ${deleted}, created: ${created}, errors: ${errors}`)

    return NextResponse.json({
      success: true,
      deleted,
      created,
      errors,
      message: `強制重新同步完成（刪除 ${deleted}，新建 ${created}${errors > 0 ? `，失敗 ${errors}` : ''}）`
    })
  } catch (error) {
    console.error('❌ [ForceSyncAll] Critical error:', error)
    return NextResponse.json({
      error: '強制同步失敗，請檢查 Google Calendar 權限後重試'
    }, { status: 500 })
  }
}
