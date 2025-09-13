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

export class GoogleCalendarService {
  private calendar

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    this.calendar = google.calendar({ version: 'v3', auth })
  }

  async listEvents(weekStart: Date): Promise<CalendarEvent[]> {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    console.log('🔍 [GoogleCalendar] Listing events:', {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      calendarId: 'primary'
    })

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    console.log('🔍 [GoogleCalendar] Found events:', response.data.items?.length || 0)
    
    // Filter for events created by our app (using extendedProperties.private.source)
    const ourEvents = (response.data.items || []).filter(event => 
      event.extendedProperties?.private?.source === 'class_sync'
    )
    
    console.log('🔍 [GoogleCalendar] Our events (filtered):', ourEvents.length)
    console.log('🔍 [GoogleCalendar] Our events details:', ourEvents.map(e => ({
      id: e.id,
      summary: e.summary,
      start: e.start,
      extendedProperties: e.extendedProperties
    })))

    return ourEvents as CalendarEvent[]
  }

  async createEvent(event: CalendarEvent): Promise<string> {
    console.log('➕ [GoogleCalendar] Creating event:', {
      summary: event.summary,
      start: event.start,
      end: event.end,
      location: event.location,
      extendedProperties: event.extendedProperties
    })

    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })

    console.log('✅ [GoogleCalendar] Event created with ID:', response.data.id)
    console.log('✅ [GoogleCalendar] Event URL:', response.data.htmlLink)

    return response.data.id!
  }

  async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
    console.log('🔄 [GoogleCalendar] Updating event:', {
      eventId,
      summary: event.summary,
      start: event.start,
      end: event.end,
      location: event.location,
      extendedProperties: event.extendedProperties
    })

    const response = await this.calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    })

    console.log('✅ [GoogleCalendar] Event updated:', response.data.id)
    console.log('✅ [GoogleCalendar] Event URL:', response.data.htmlLink)
  }

  async deleteEvent(eventId: string): Promise<void> {
    console.log('🗑️ [GoogleCalendar] Deleting event:', eventId)

    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId,
    })

    console.log('✅ [GoogleCalendar] Event deleted:', eventId)
  }

  scheduleEventToCalendarEvent(
    scheduleEvent: ScheduleEvent,
    weekStart: Date,
    courseLinks?: { name: string; url: string }[]
  ): CalendarEvent {
    console.log('🔄 [GoogleCalendar] Converting schedule event to calendar event:', {
      courseName: scheduleEvent.courseName,
      weekday: scheduleEvent.weekday,
      periodStart: scheduleEvent.periodStart,
      periodEnd: scheduleEvent.periodEnd,
      weekStart: weekStart.toISOString()
    })

    const eventDate = new Date(weekStart)
    console.log('📅 [GoogleCalendar] Date calculation:', {
      weekStart: weekStart.toISOString(),
      weekday: scheduleEvent.weekday,
      weekStartDay: weekStart.getDay(),
      daysToAdd: scheduleEvent.weekday - 1,
      beforeSetDate: eventDate.toISOString()
    })
    
    // Fix: Use setDate() correctly to handle month boundaries
    // weekday is 1-based (Monday=1, Tuesday=2, etc.)
    // weekStart is guaranteed to be Monday, so we add (weekday - 1) days
    const daysToAdd = scheduleEvent.weekday - 1
    eventDate.setDate(eventDate.getDate() + daysToAdd)
    console.log('📅 [GoogleCalendar] Final event date:', eventDate.toISOString())

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

    // 支援多連結格式：Calendar 顯示 "- 名稱: 連結"
    if (courseLinks && courseLinks.length > 0) {
      description += '\n\n課程連結：'
      courseLinks.forEach(link => {
        description += `\n- ${link.name}: ${link.url}`
      })
    } else if (scheduleEvent.url) {
      // 向後相容：如果沒有多連結但有單一 URL
      description += `\n\n課程連結：${scheduleEvent.url}`
    }

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
      1: [825, 910],   // 08:25-09:10
      2: [920, 1005],  // 09:20-10:05
      3: [1015, 1100], // 10:15-11:00
      4: [1110, 1155], // 11:10-11:55
      5: [1315, 1400], // 13:15-14:00
      6: [1410, 1455], // 14:10-14:55
      7: [1505, 1550], // 15:05-15:50
      8: [1600, 1645], // 16:00-16:45
    }

    const periodTimes = times[period as keyof typeof times]
    return isStart ? periodTimes[0] : periodTimes[1]
  }
}