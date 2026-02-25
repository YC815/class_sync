import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { ensureGoogleAccess, ReauthRequiredError } from '@/lib/google-auth'
import { ScheduleEvent } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionWithTokens = session as any
    const accessToken = sessionWithTokens.accessToken
    const refreshToken = sessionWithTokens.refreshToken
    const expiresAt = sessionWithTokens.expiresAt

    if (!accessToken) {
      return NextResponse.json({
        error: 'reauth_required',
        message: 'Google 帳戶未連結或 token 已過期，請重新登入。'
      }, { status: 401 })
    }

    let validAccessToken: string
    try {
      validAccessToken = await ensureGoogleAccess({ accessToken, refreshToken, expiresAt }, session.user.id)
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        return NextResponse.json({ error: 'reauth_required', message: error.message }, { status: 401 })
      }
      return NextResponse.json({ error: 'auth_error', message: '認證檢查失敗，請稍後重試。' }, { status: 500 })
    }

    const userId = session.user.id
    const weekStart = new Date(weekStartStr + 'T00:00:00.000Z')
    const calendarService = new GoogleCalendarService(validAccessToken)

    console.log(`🔄 [ForceSync] Processing week: ${weekStartStr}`)

    // Step 1: Delete all Calendar events for this week
    let deleted = 0
    try {
      const calendarEvents = await calendarService.listEvents(weekStart)
      for (const calEvent of calendarEvents) {
        if (!calEvent.id) continue
        try {
          await calendarService.deleteEvent(calEvent.id)
          deleted++
        } catch (err: any) {
          const status = err?.code || err?.status || err?.response?.status
          if (status === 404 || status === 410) continue
          console.warn(`⚠️ [ForceSync] Failed to delete ${calEvent.id}:`, err)
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
      console.error(`❌ [ForceSync] Failed to list events for ${weekStartStr}:`, err)
    }

    // Step 2: Clear calendarEventId in DB for this week
    await prisma.event.updateMany({
      where: { userId, weekStart },
      data: { calendarEventId: null }
    })

    // Step 3: Re-query and recreate
    const events = await prisma.event.findMany({
      where: { userId, weekStart }
    })

    let created = 0
    let errors = 0

    for (const event of events) {
      try {
        let location = ''
        if (event.baseName && event.roomName) {
          location = `${event.baseName} - ${event.roomName}`
        } else if (event.baseName) {
          location = event.baseName
        } else if (event.roomName) {
          location = event.roomName
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

        const calendarPayload = calendarService.scheduleEventToCalendarEvent(scheduleEvent, weekStart)
        const newCalendarEventId = await calendarService.createEvent(calendarPayload)
        await prisma.event.update({
          where: { id: event.id },
          data: { calendarEventId: newCalendarEventId }
        })
        created++
      } catch (eventError: any) {
        const statusCode = eventError?.code || eventError?.response?.status
        if (statusCode === 401) {
          return NextResponse.json({
            error: 'reauth_required',
            message: 'Google Calendar 授權失敗，請重新登入。'
          }, { status: 401 })
        }
        console.error(`❌ [ForceSync] Failed to create event ${event.id}:`, eventError)
        errors++
      }
    }

    console.log(`✅ [ForceSync] Week ${weekStartStr} — deleted: ${deleted}, created: ${created}, errors: ${errors}`)
    return NextResponse.json({ success: true, deleted, created, errors })
  } catch (error) {
    console.error('❌ [ForceSync] Critical error:', error)
    return NextResponse.json({ error: '強制同步失敗' }, { status: 500 })
  }
}
