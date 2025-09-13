import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'

// Helper function to extract metadata from description (same as in route.ts)
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ [Recovery] Unauthorized: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id

    console.log('🔄 [Recovery] Starting manual recovery for week:', weekStartStr, 'userId:', userId)

    // Get access token from session
    const accessToken = (session as { accessToken?: string }).accessToken

    if (!accessToken) {
      console.log('❌ [Recovery] No access token available')
      return NextResponse.json({
        error: 'Google account not connected or token expired. Please sign out and sign in again.'
      }, { status: 401 })
    }

    const calendarService = new GoogleCalendarService(accessToken)
    console.log('✅ [Recovery] Google Calendar service initialized')

    let recoveredEvents = 0
    let linkedEvents = 0
    let errors: string[] = []

    try {
      // Get all ClassSync events from Google Calendar for this week
      const calendarEvents = await calendarService.listEvents(weekStart)
      console.log('📅 [Recovery] Found Google Calendar events:', calendarEvents.length)
      console.log('📅 [Recovery] Calendar events details:', calendarEvents.map(e => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime,
        hasExtendedProps: !!e.extendedProperties?.private,
        hasDescription: !!e.description,
        descriptionLength: e.description?.length || 0
      })))

      if (calendarEvents.length === 0) {
        console.log('📅 [Recovery] No ClassSync events found in Google Calendar')
        return NextResponse.json({
          success: true,
          recoveredEvents: 0,
          linkedEvents: 0,
          message: '在 Google Calendar 中沒有找到需要恢復的 ClassSync 事件'
        })
      }

      // Get existing events from database
      const dbEvents = await prisma.event.findMany({
        where: { userId, weekStart }
      })

      console.log('📋 [Recovery] Found database events:', dbEvents.length)

      // Create maps for efficient lookup
      const existingCalendarIds = new Set(
        dbEvents
          .filter(e => e.calendarEventId)
          .map(e => e.calendarEventId!)
      )

      const dbEventsByKey = new Map()
      dbEvents.forEach(event => {
        const key = `${event.weekday}-${event.periodStart}-${event.periodEnd}-${event.courseName}`
        dbEventsByKey.set(key, event)
      })

      // Process each calendar event
      for (const calEvent of calendarEvents) {
        if (!calEvent.id) continue

        // Skip if already linked
        if (existingCalendarIds.has(calEvent.id)) {
          continue
        }

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

        // Check if we have a matching database event without calendarEventId
        const eventKey = `${weekday}-${periodStart}-${periodEnd}-${courseName}`
        const matchingDbEvent = dbEventsByKey.get(eventKey)

        if (matchingDbEvent && !matchingDbEvent.calendarEventId) {
          // Link existing database event with calendar event
          try {
            await prisma.event.update({
              where: { id: matchingDbEvent.id },
              data: { calendarEventId: calEvent.id }
            })
            linkedEvents++
            console.log(`🔗 [Recovery] Linked DB event ${matchingDbEvent.id} with Calendar event ${calEvent.id}`)
          } catch (linkError) {
            const errorMsg = `Failed to link event ${matchingDbEvent.id} with ${calEvent.id}: ${linkError}`
            console.error('❌ [Recovery]', errorMsg)
            errors.push(errorMsg)
          }
        } else if (!matchingDbEvent) {
          // Create new database event
          try {
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

            // Try to find matching base and room IDs from the database
            let baseId: string | null = null
            let roomId: string | null = null

            if (baseName) {
              const matchingBase = await prisma.base.findFirst({
                where: {
                  userId,
                  name: baseName
                }
              })
              baseId = matchingBase?.id || null

              if (matchingBase && roomName) {
                const matchingRoom = await prisma.room.findFirst({
                  where: {
                    userId,
                    baseId: matchingBase.id,
                    name: roomName
                  }
                })
                roomId = matchingRoom?.id || null
              }
            }

            console.log(`🔗 [Recovery] Database matching:`, {
              baseName,
              roomName,
              baseId,
              roomId,
              address
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
                baseId: baseId,
                roomId: roomId,
                baseName: baseName,
                roomName: roomName,
                address: address,
              }
            })
            recoveredEvents++
            console.log(`✅ [Recovery] Created new Event record:`, {
              id: newEvent.id,
              calendarEventId: calEvent.id,
              courseName
            })
          } catch (createError) {
            const errorMsg = `Failed to create event for ${calEvent.id}: ${createError}`
            console.error('❌ [Recovery]', errorMsg)
            errors.push(errorMsg)
          }
        }
      }

      console.log('✅ [Recovery] Recovery completed:', {
        recoveredEvents,
        linkedEvents,
        totalProcessed: calendarEvents.length,
        errors: errors.length
      })

      return NextResponse.json({
        success: true,
        recoveredEvents,
        linkedEvents,
        totalCalendarEvents: calendarEvents.length,
        errors: errors.length > 0 ? errors : undefined,
        message: (recoveredEvents + linkedEvents) > 0
          ? `成功恢復 ${recoveredEvents} 個事件，連結 ${linkedEvents} 個事件`
          : '所有事件都已經正確同步，無需恢復'
      })

    } catch (calendarError: any) {
      console.error('❌ [Recovery] Failed to fetch Google Calendar events:', calendarError.message)

      if (calendarError.status === 401 || calendarError.code === 401) {
        console.log('🔑 [Recovery] OAuth token expired or invalid')
        return NextResponse.json({
          error: 'Google Calendar access expired. Please sign out and sign in again to refresh your permissions.',
          code: 'TOKEN_EXPIRED'
        }, { status: 401 })
      }

      return NextResponse.json({
        error: '無法從 Google Calendar 獲取事件資料',
        details: calendarError.message
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ [Recovery] Critical error during recovery:', {
      error: error,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({
      error: '事件恢復失敗，請檢查 Google Calendar 權限後重試'
    }, { status: 500 })
  }
}