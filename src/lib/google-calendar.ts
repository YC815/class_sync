import { google } from 'googleapis'
import { ScheduleEvent } from './types'

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export interface CalendarEvent {
  id?: string
  summary: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  location?: string
  description?: string
  extendedProperties?: {
    private?: {
      source?: string
      weekStart?: string
      weekday?: string
      periodStart?: string
      periodEnd?: string
      courseId?: string
      seriesId?: string
    }
  }
}

export interface ClassSyncMetadata {
  source: string
  weekStart: string
  weekday: number
  periodStart: number
  periodEnd: number
  courseId: string | null
  seriesId: string | null
  courseName: string
  location: string | null
  isCustomCourse?: boolean
  timestamp: string
}

export class GoogleCalendarService {
  private calendar

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    this.calendar = google.calendar({ version: 'v3', auth })
  }

  async listEvents(weekStart: Date): Promise<CalendarEvent[]> {
    const weekEnd = new Date(weekStart)
    // Include Sunday events by setting timeMax to next Monday 00:00
    weekEnd.setDate(weekStart.getDate() + 7)

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [GoogleCalendar] Listing events:', {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        calendarId: 'primary'
      })
    }

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [GoogleCalendar] Found events:', response.data.items?.length || 0)
    }

    // Filter for events created by our app (using extendedProperties.private.source)
    const ourEvents = (response.data.items || []).filter(event =>
      event.extendedProperties?.private?.source === 'class_sync'
    )

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [GoogleCalendar] Our events (filtered):', ourEvents.length)
    }

    return ourEvents as CalendarEvent[]
  }

  async createEvent(event: CalendarEvent): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('➕ [GoogleCalendar] Creating event:', {
        summary: event.summary,
        start: event.start,
        end: event.end,
        location: event.location,
        extendedProperties: event.extendedProperties
      })
    }

    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [GoogleCalendar] Event created with ID:', response.data.id)
    }

    return response.data.id!
  }

  async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 [GoogleCalendar] Updating event:', {
        eventId,
        summary: event.summary,
        start: event.start,
        end: event.end,
        location: event.location,
        extendedProperties: event.extendedProperties
      })
    }

    const response = await this.calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [GoogleCalendar] Event updated:', response.data.id)
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🗑️ [GoogleCalendar] Deleting event:', eventId)
    }

    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId,
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [GoogleCalendar] Event deleted:', eventId)
    }
  }

  /**
   * 從 Google Calendar 事件描述中解析 ClassSync JSON 標記
   */
  parseClassSyncMetadata(description: string | null | undefined): ClassSyncMetadata | null {
    if (!description) return null

    try {
      // 尋找 ClassSync 資料標記
      const classSyncPattern = /---\nClassSync 資料：\n([\s\S]*)/
      const match = description.match(classSyncPattern)

      if (!match || !match[1]) return null

      const jsonStr = match[1].trim()
      const metadata = JSON.parse(jsonStr) as ClassSyncMetadata

      // 驗證是否為 ClassSync 來源
      if (metadata.source !== 'class_sync') return null

      return metadata
    } catch (error) {
      console.warn('Failed to parse ClassSync metadata from description:', error)
      return null
    }
  }


  scheduleEventToCalendarEvent(
    scheduleEvent: ScheduleEvent,
    weekStart: Date
  ): CalendarEvent {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 [GoogleCalendar] Converting schedule event to calendar event:', {
        courseName: scheduleEvent.courseName,
        weekday: scheduleEvent.weekday,
        periodStart: scheduleEvent.periodStart,
        periodEnd: scheduleEvent.periodEnd,
        weekStart: weekStart.toISOString()
      })
    }

    const eventDate = new Date(weekStart)
    
    // Fix: Use setDate() correctly to handle month boundaries
    // weekday is 1-based (Monday=1, Tuesday=2, etc.)
    // weekStart is guaranteed to be Monday, so we add (weekday - 1) days
    const daysToAdd = scheduleEvent.weekday - 1
    eventDate.setDate(eventDate.getDate() + daysToAdd)

    const startTime = this.getPeriodTime(scheduleEvent.periodStart, true)
    const endTime = this.getPeriodTime(scheduleEvent.periodEnd, false)

    // 直接在本地時間創建日期時間，避免時區轉換問題
    const start = new Date(eventDate)
    start.setHours(Math.floor(startTime / 100), startTime % 100, 0, 0)

    const end = new Date(eventDate)
    end.setHours(Math.floor(endTime / 100), endTime % 100, 0, 0)
    
    // 格式化為 ISO 字串，但手動指定台北時區 +08:00
    const formatToTaipeiTime = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
    }
    
    const startDateTime = formatToTaipeiTime(start)
    const endDateTime = formatToTaipeiTime(end)

    console.log('⏰ [GoogleCalendar] Event timing:', {
      eventDate: eventDate.toISOString(),
      startTime: startDateTime,
      endTime: endDateTime,
      taipeiTime: {
        start: `${Math.floor(startTime / 100)}:${String(startTime % 100).padStart(2, '0')}`,
        end: `${Math.floor(endTime / 100)}:${String(endTime % 100).padStart(2, '0')}`
      }
    })

    let description = `第 ${scheduleEvent.periodStart}`
    if (scheduleEvent.periodStart !== scheduleEvent.periodEnd) {
      description += `-${scheduleEvent.periodEnd}`
    }
    description += ' 節'

    // 在描述末尾加入 JSON 元數據供程式讀取
    const metadata = {
      source: 'class_sync',
      weekStart: formatDateLocal(weekStart),
      weekday: scheduleEvent.weekday,
      periodStart: scheduleEvent.periodStart,
      periodEnd: scheduleEvent.periodEnd,
      courseId: scheduleEvent.courseId || null,
      seriesId: scheduleEvent.seriesId || null,
      courseName: scheduleEvent.courseName,
      location: scheduleEvent.location || null,
      isCustomCourse: !scheduleEvent.courseId, // 標記是否為自訂課程（沒有courseId的為自訂課程）
      timestamp: new Date().toISOString()
    }

    description += `\n\n---\nClassSync 資料：\n${JSON.stringify(metadata, null, 2)}`

    const calendarEvent = {
      summary: scheduleEvent.courseName,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Taipei',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Taipei',
      },
      // 移除地點欄位的自動輸入，改為空值或字串格式
      location: scheduleEvent.location || '',
      description,
      extendedProperties: {
        private: {
          source: 'class_sync',
          weekStart: formatDateLocal(weekStart),
          weekday: scheduleEvent.weekday.toString(),
          periodStart: scheduleEvent.periodStart.toString(),
          periodEnd: scheduleEvent.periodEnd.toString(),
          courseId: scheduleEvent.courseId || '',
          seriesId: scheduleEvent.seriesId || '',
        },
      },
    }

    console.log('📅 [GoogleCalendar] Generated calendar event:', calendarEvent)

    return calendarEvent
  }

  private getPeriodTime(period: number, isStart: boolean): number {
    const times = {
      1: [825, 915],   // 08:25-09:15
      2: [915, 1005],  // 09:15-10:05
      3: [1015, 1105], // 10:15-11:05
      4: [1105, 1155], // 11:05-11:55
      5: [1325, 1415], // 13:25-14:15
      6: [1415, 1505], // 14:15-15:05
      7: [1515, 1605], // 15:15-16:05
      8: [1605, 1655], // 16:05-16:55
    }

    const periodTimes = times[period as keyof typeof times]
    return isStart ? periodTimes[0] : periodTimes[1]
  }
}