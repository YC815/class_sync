import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { WeekSchedule } from '@/lib/types'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { ensureGoogleAccess, ReauthRequiredError } from '@/lib/google-auth'

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

        // If a DB event already exists for this slot, skip — don't re-link unsynced records
        if (existingEventKeys.has(eventKey)) {
          console.log(`⚠️ [Recovery] Skipping event with matching key: ${eventKey}, DB record already exists`)
          continue
        }

        // Create new Event record
        // Try to extract detailed location info from metadata first
        let baseName: string | null = null
        let roomName: string | null = null
        let address: string | null = null

        // Extract from description metadata if available
        const descMetadata = extractMetadataFromDescription(calEvent.description || '')
        if (descMetadata?.location) {
          console.log(`🔍 [Recovery] Found location in description metadata:`, descMetadata.location)
          baseName = descMetadata.location
          address = descMetadata.address || null
        } else if ((metadata as any)?.location) {
          // If extended properties has location info, use it
          console.log(`🔍 [Recovery] Found location in extended properties:`, (metadata as any).location)
          baseName = (metadata as any).location
          address = (metadata as any).address || null
        } else {
          // Fallback to calendar event location field
          console.log(`🔍 [Recovery] Using calendar event location:`, calEvent.location)
          baseName = calEvent.location || null
          address = calEvent.location || null
        }

        // Try to extract base and room from location string if it's in "base - room" format
        if (baseName && baseName.includes(' - ')) {
          const parts = baseName.split(' - ')
          if (parts.length === 2) {
            baseName = parts[0].trim()
            roomName = parts[1].trim()
            console.log(`🔍 [Recovery] Split location into base: "${baseName}" and room: "${roomName}"`)
          }
        }

        // 確保 Week 記錄存在，如果不存在則創建
        await prisma.week.upsert({
          where: {
            userId_weekStart: {
              userId,
              weekStart
            }
          },
          update: {},
          create: {
            userId,
            weekStart
          }
        })

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
            baseName: baseName,
            roomName: roomName,
            address: address,
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
      1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}
    }

    let totalEvents = 0
    let recoveryInfo: { recoveredEvents: number, errors: string[] } | null = null

    try {
      // 每次載入都先自動恢復 Google Calendar 事件
      console.log('🔄 [LoadSchedule] Starting automatic recovery from Google Calendar')
      
      // 確保 access token 有效（自動刷新過期的 token）
      let accessToken: string | undefined
      try {
        if (session.accessToken && session.refreshToken && session.expiresAt) {
          accessToken = await ensureGoogleAccess({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt
          }, session.user.id)
        }
      } catch (error) {
        if (error instanceof ReauthRequiredError) {
          console.log('❌ [LoadSchedule] Token refresh failed, skipping auto-recovery:', error.message)
          // 不回傳錯誤，讓使用者可以繼續使用本地課表
          recoveryInfo = { recoveredEvents: 0, errors: ['Google Calendar 授權已過期，請重新登入以恢復同步功能'] }
        } else {
          throw error
        }
      }
      
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

      // 直接從 events 表重建課表（唯一真相來源）
      console.log('Building schedule from events table (single source of truth)')
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

      console.log('Found events:', events.length)
      totalEvents = events.length

      // 重建完整課表
      schedule = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {} }
      events.forEach(event => {
        // 為每個時段填入課程資訊
        for (let period = event.periodStart; period <= event.periodEnd; period++) {
          if (!schedule[event.weekday]) {
            schedule[event.weekday] = {}
          }

          schedule[event.weekday][period] = {
            courseId: event.courseId || undefined,
            courseName: event.courseName || '',
            base: event.baseName || undefined,
            room: event.roomName || undefined,
            location: event.baseName ?
              (event.baseName + (event.roomName ? ' - ' + event.roomName : '')) :
              undefined,
            address: event.address || undefined,
          }
        }
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      // 如果資料庫查詢失敗，返回空課表而不是錯誤
      // 確保返回完整的週課表結構
      schedule = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {} }
      for (let day = 1; day <= 7; day++) {
        for (let period = 1; period <= 8; period++) {
          schedule[day][period] = null
        }
      }
    }

    // 確保返回的課表包含完整的週末結構
    const completeSchedule: WeekSchedule = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {} }
    for (let day = 1; day <= 7; day++) {
      completeSchedule[day as keyof WeekSchedule] = schedule[day] || {}
      // 確保每一天都有完整的時段結構
      for (let period = 1; period <= 8; period++) {
        if (completeSchedule[day as keyof WeekSchedule][period] === undefined) {
          completeSchedule[day as keyof WeekSchedule][period] = null
        }
      }
    }

    return NextResponse.json({
      schedule: completeSchedule,
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