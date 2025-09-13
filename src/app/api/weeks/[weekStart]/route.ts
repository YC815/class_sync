import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { WeekSchedule } from '@/lib/types'
import { GoogleCalendarService } from '@/lib/google-calendar'

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// Helper function to recover events from Google Calendar
// Helper function to extract metadata from description
function extractMetadataFromDescription(description: string): any {
  if (!description) return null

  try {
    const jsonMatch = description.match(/ClassSync 資料：\s*\n({[\s\S]*?})(?:\n|$)/m)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
  } catch (error) {
    console.warn('Failed to parse description metadata:', error)
  }

  return null
}

async function recoverEventsFromCalendar(
  userId: string,
  weekStart: Date,
  accessToken: string
): Promise<{ recoveredEvents: number, errors: string[] }> {
  const errors: string[] = []
  let recoveredEvents = 0

  console.log(`🔍 [Recovery] Starting recovery for user ${userId}, week ${weekStart.toISOString()}`)

  try {
    const calendarService = new GoogleCalendarService(accessToken)
    const calendarEvents = await calendarService.listEvents(weekStart)

    console.log(`🔍 [Recovery] Found ${calendarEvents.length} ClassSync events in Google Calendar`)

    // Get existing events from database to avoid duplicates
    const existingEvents = await prisma.event.findMany({
      where: { userId, weekStart }
    })

    console.log(`🔍 [Recovery] Found ${existingEvents.length} existing events in database`)

    const existingCalendarIds = new Set(
      existingEvents
        .filter(e => e.calendarEventId)
        .map(e => e.calendarEventId!)
    )

    console.log(`🔍 [Recovery] Existing calendar IDs in DB:`, Array.from(existingCalendarIds))

    // Create map of existing events by course name and time for better matching
    const existingEventKeys = new Set(
      existingEvents.map(e => `${e.courseName}-${e.weekday}-${e.periodStart}-${e.periodEnd}`)
    )

    for (const calEvent of calendarEvents) {
      if (!calEvent.id) {
        console.log(`⚠️ [Recovery] Skipping event without ID`)
        continue
      }

      console.log(`🔍 [Recovery] Processing calendar event:`, {
        id: calEvent.id,
        summary: calEvent.summary,
        start: calEvent.start?.dateTime,
        hasExtendedProps: !!calEvent.extendedProperties?.private,
        description: calEvent.description?.substring(0, 100) + '...'
      })

      if (existingCalendarIds.has(calEvent.id)) {
        console.log(`⚠️ [Recovery] Event ${calEvent.id} already linked in database, skipping`)
        continue
      }

      try {
        // Try to get metadata from extended properties first
        let metadata = calEvent.extendedProperties?.private
        let weekday: number, periodStart: number, periodEnd: number

        if (metadata?.weekday) {
          console.log(`🔍 [Recovery] Using extended properties metadata:`, metadata)
          weekday = parseInt(metadata.weekday)
          periodStart = parseInt(metadata.periodStart || '1')
          periodEnd = parseInt(metadata.periodEnd || periodStart.toString())
        } else {
          // Try to extract from description
          const descMetadata = extractMetadataFromDescription(calEvent.description || '')
          if (descMetadata) {
            console.log(`🔍 [Recovery] Using description metadata:`, descMetadata)
            weekday = descMetadata.weekday
            periodStart = descMetadata.periodStart
            periodEnd = descMetadata.periodEnd
            metadata = descMetadata
          } else {
            console.warn(`🔍 [Recovery] Calendar event ${calEvent.id} missing both extended properties and description metadata`)
            continue
          }
        }

        const courseName = calEvent.summary || '未知課程'
        const eventKey = `${courseName}-${weekday}-${periodStart}-${periodEnd}`

        // Check if we already have this event by content match
        if (existingEventKeys.has(eventKey)) {
          console.log(`🔗 [Recovery] Found existing event by content match: ${eventKey}, linking with calendar ID`)

          // Find the existing event and update it with calendar ID
          const existingEvent = existingEvents.find(e =>
            e.courseName === courseName &&
            e.weekday === weekday &&
            e.periodStart === periodStart &&
            e.periodEnd === periodEnd &&
            !e.calendarEventId
          )

          if (existingEvent) {
            await prisma.event.update({
              where: { id: existingEvent.id },
              data: { calendarEventId: calEvent.id }
            })
            console.log(`🔗 [Recovery] Linked existing DB event ${existingEvent.id} with calendar event ${calEvent.id}`)
            recoveredEvents++
          }
        } else {
          // Create new Event record
          const newEvent = await prisma.event.create({
            data: {
              userId,
              weekStart,
              weekday,
              periodStart,
              periodEnd,
              courseId: metadata?.courseId || null,
              courseName,
              calendarEventId: calEvent.id,
              seriesId: metadata?.seriesId || null,
              baseName: calEvent.location || null,
              address: calEvent.location || null,
            }
          })

          console.log(`✅ [Recovery] Created new Event record:`, {
            id: newEvent.id,
            calendarEventId: calEvent.id,
            courseName,
            weekday,
            periodStart,
            periodEnd
          })

          recoveredEvents++
        }
      } catch (eventError) {
        const errorMsg = `Failed to recover event ${calEvent.id}: ${eventError}`
        console.error('❌ [Recovery]', errorMsg)
        errors.push(errorMsg)
      }
    }
  } catch (calendarError) {
    const errorMsg = `Failed to fetch from Google Calendar: ${calendarError}`
    console.error('❌ [Recovery]', errorMsg)
    errors.push(errorMsg)
  }

  console.log(`🔍 [Recovery] Recovery completed: ${recoveredEvents} events recovered, ${errors.length} errors`)
  return { recoveredEvents, errors }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart
    
    console.log('API called with weekStart:', weekStartStr)

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('No session found')
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id

    console.log('Fetching schedule for:', { userId, weekStart: weekStart.toISOString() })

    let schedule: WeekSchedule = {
      1: {}, 2: {}, 3: {}, 4: {}, 5: {}
    }

    let totalEvents = 0
    let recoveryInfo: { recoveredEvents: number, errors: string[] } | null = null

    try {
      // 首先嘗試從 Week 表獲取原始課表資料
      const weekRecord = await prisma.week.findUnique({
        where: {
          userId_weekStart: {
            userId,
            weekStart
          }
        }
      })

      // 每次載入都先自動恢復 Google Calendar 事件（無論是否有 Week 記錄）
      console.log('🔄 [LoadSchedule] Starting automatic recovery from Google Calendar')
      const accessToken = (session as { accessToken?: string }).accessToken
      if (accessToken) {
        try {
          recoveryInfo = await recoverEventsFromCalendar(userId, weekStart, accessToken)
          if (recoveryInfo.recoveredEvents > 0) {
            console.log(`✅ [LoadSchedule] Auto-recovered ${recoveryInfo.recoveredEvents} events from Google Calendar`)
          } else {
            console.log(`🔍 [LoadSchedule] No events needed recovery from Google Calendar`)
          }
        } catch (recoveryError) {
          console.error('❌ [LoadSchedule] Failed to auto-recover events:', recoveryError)
          recoveryInfo = { recoveredEvents: 0, errors: [recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error'] }
        }
      } else {
        console.warn('⚠️ [LoadSchedule] No access token available for auto-recovery')
      }

      if (weekRecord && weekRecord.data) {
        // 如果有保存的課表資料，但可能需要補充恢復的事件
        schedule = weekRecord.data as WeekSchedule
        console.log('Found week record with data, checking if events need to be added to schedule')

        // 重新從事件構建課表以包含任何新恢復的事件
        const events = await prisma.event.findMany({
          where: {
            userId,
            weekStart
          },
          orderBy: [
            { weekday: 'asc' },
            { periodStart: 'asc' }
          ]
        })

        console.log('Found events (after recovery):', events.length)
        totalEvents = events.length

        // 重建完整課表
        schedule = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }
        events.forEach(event => {
          // 為每個時段填入課程資訊
          for (let period = event.periodStart; period <= event.periodEnd; period++) {
            if (!schedule[event.weekday]) {
              schedule[event.weekday] = {}
            }

            schedule[event.weekday][period] = {
              courseId: event.courseId || undefined,
              courseName: event.courseName || ''
            }
          }
        })
      } else {
        console.log('No week record found, building schedule from events after recovery...')

        // 從事件重建課表（包括任何新恢復的事件）
        const events = await prisma.event.findMany({
          where: {
            userId,
            weekStart
          },
          orderBy: [
            { weekday: 'asc' },
            { periodStart: 'asc' }
          ]
        })

        console.log('Found events (after recovery):', events.length)
        totalEvents = events.length

        events.forEach(event => {
          // 為每個時段填入課程資訊
          for (let period = event.periodStart; period <= event.periodEnd; period++) {
            if (!schedule[event.weekday]) {
              schedule[event.weekday] = {}
            }

            schedule[event.weekday][period] = {
              courseId: event.courseId || undefined,
              courseName: event.courseName || ''
            }
          }
        })
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      // 如果資料庫查詢失敗，返回空課表而不是錯誤
    }

    return NextResponse.json({
      schedule,
      weekStart: formatDateLocal(weekStart),
      totalEvents,
      recoveryInfo: recoveryInfo?.recoveredEvents ? {
        recoveredEvents: recoveryInfo.recoveredEvents,
        hasErrors: recoveryInfo.errors.length > 0
      } : undefined
    })
  } catch (error) {
    console.error('Error fetching week schedule:', error)
    return NextResponse.json({ 
      error: '獲取課表失敗', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}