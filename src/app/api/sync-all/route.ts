import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { ensureGoogleAccess, ReauthRequiredError } from '@/lib/google-auth'
import { ScheduleEvent } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ [SyncAll] Unauthorized: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionWithTokens = session as any
    const accessToken = sessionWithTokens.accessToken
    const refreshToken = sessionWithTokens.refreshToken
    const expiresAt = sessionWithTokens.expiresAt

    if (!accessToken) {
      console.log('❌ [SyncAll] No access token available')
      return NextResponse.json({
        error: 'reauth_required',
        message: 'Google 帳戶未連結或 token 已過期，請重新登入。'
      }, { status: 401 })
    }

    let validAccessToken: string
    try {
      validAccessToken = await ensureGoogleAccess({ accessToken, refreshToken, expiresAt }, session.user.id)
      console.log('✅ [SyncAll] Google access token validated')
    } catch (error) {
      console.error('❌ [SyncAll] Token validation/refresh failed:', error)
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

    // Query all unsynced events for this user
    const unsyncedEvents = await prisma.event.findMany({
      where: { userId, calendarEventId: null }
    })

    console.log(`🔄 [SyncAll] Found ${unsyncedEvents.length} unsynced events`)

    if (unsyncedEvents.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        linked: 0,
        replaced: 0,
        errors: 0,
        message: '所有活動已同步'
      })
    }

    // Group by weekStart Date (using timestamp as map key)
    const byWeek = new Map<number, { weekStart: Date; events: typeof unsyncedEvents }>()
    for (const event of unsyncedEvents) {
      const key = event.weekStart.getTime()
      if (!byWeek.has(key)) {
        byWeek.set(key, { weekStart: event.weekStart, events: [] })
      }
      byWeek.get(key)!.events.push(event)
    }

    let created = 0
    let linked = 0
    let replaced = 0
    let errors = 0

    for (const { weekStart, events } of byWeek.values()) {
      console.log(`🔄 [SyncAll] Processing week: ${weekStart.toISOString()}, events: ${events.length}`)

      // Fetch all ClassSync Calendar events for this week
      const calendarEvents = await calendarService.listEvents(weekStart)

      // Build slot map: "weekday-periodStart-periodEnd" -> CalendarEvent[]
      const slotMap = new Map<string, typeof calendarEvents>()
      for (const calEvent of calendarEvents) {
        const priv = calEvent.extendedProperties?.private
        if (!priv?.weekday || !priv?.periodStart || !priv?.periodEnd) continue
        const key = `${priv.weekday}-${priv.periodStart}-${priv.periodEnd}`
        if (!slotMap.has(key)) slotMap.set(key, [])
        slotMap.get(key)!.push(calEvent)
      }

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

          // Build ScheduleEvent for calendar conversion
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
            weekStart
          )

          const slotKey = `${event.weekday}-${event.periodStart}-${event.periodEnd}`
          const existingCalEvents = slotMap.get(slotKey) ?? []

          if (existingCalEvents.length > 0) {
            const existing = existingCalEvents[0]
            const existingCourseId = existing.extendedProperties?.private?.courseId ?? ''
            const existingSummary = existing.summary ?? ''

            const sameCourse =
              existingCourseId === (event.courseId ?? '') &&
              existingSummary === event.courseName

            if (sameCourse) {
              // Same course at same slot — update Calendar event (pushes location/title changes), then link
              console.log(`🔗 [SyncAll] Updating and linking event ${event.id} to existing Calendar event ${existing.id}`)
              await calendarService.updateEvent(existing.id!, calendarPayload)
              await prisma.event.update({
                where: { id: event.id },
                data: { calendarEventId: existing.id! }
              })
              linked++

              // Delete any duplicate Calendar events at the same slot
              for (let i = 1; i < existingCalEvents.length; i++) {
                try {
                  await calendarService.deleteEvent(existingCalEvents[i].id!)
                } catch {
                  // ignore duplicate cleanup errors
                }
              }
            } else {
              // Different course at same slot — delete old Calendar events, create new
              console.log(`♻️ [SyncAll] Replacing Calendar event at slot ${slotKey} for event ${event.id}`)
              for (const oldCalEvent of existingCalEvents) {
                try {
                  await calendarService.deleteEvent(oldCalEvent.id!)
                } catch (err: any) {
                  const status = err?.code || err?.status || err?.response?.status
                  if (status !== 404 && status !== 410) throw err
                }
              }
              const newCalendarEventId = await calendarService.createEvent(calendarPayload)
              await prisma.event.update({
                where: { id: event.id },
                data: { calendarEventId: newCalendarEventId }
              })
              replaced++
            }
          } else {
            // No existing Calendar event — create new
            console.log(`➕ [SyncAll] Creating new Calendar event for DB event ${event.id}`)
            const newCalendarEventId = await calendarService.createEvent(calendarPayload)
            await prisma.event.update({
              where: { id: event.id },
              data: { calendarEventId: newCalendarEventId }
            })
            created++
          }
        } catch (eventError: any) {
          const statusCode = eventError?.code || eventError?.response?.status
          if (statusCode === 401) {
            console.error('❌ [SyncAll] Unauthorized while syncing event:', eventError)
            return NextResponse.json({
              error: 'reauth_required',
              message: 'Google Calendar 授權失敗，請重新登入。'
            }, { status: 401 })
          }
          console.error('❌ [SyncAll] Failed to sync event:', {
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

    const total = created + linked + replaced
    console.log(`✅ [SyncAll] Done — created: ${created}, linked: ${linked}, replaced: ${replaced}, errors: ${errors}`)

    return NextResponse.json({
      success: true,
      created,
      linked,
      replaced,
      errors,
      message: `成功同步 ${total} 個事件（新增 ${created}，連結 ${linked}，替換 ${replaced}）`
    })
  } catch (error) {
    console.error('❌ [SyncAll] Critical error:', error)
    return NextResponse.json({
      error: '同步失敗，請檢查 Google Calendar 權限後重試'
    }, { status: 500 })
  }
}
