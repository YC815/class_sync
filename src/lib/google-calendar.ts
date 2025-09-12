import { google } from 'googleapis'
import { ScheduleEvent } from './types'

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

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      q: 'source:class_sync', // Filter for our events
    })

    return response.data.items as CalendarEvent[]
  }

  async createEvent(event: CalendarEvent): Promise<string> {
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })

    return response.data.id!
  }

  async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
    await this.calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    })
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId,
    })
  }

  scheduleEventToCalendarEvent(
    scheduleEvent: ScheduleEvent,
    weekStart: Date,
    courseLinks?: { name: string; url: string }[]
  ): CalendarEvent {
    const eventDate = new Date(weekStart)
    eventDate.setDate(weekStart.getDate() + scheduleEvent.weekday - 1)

    const startTime = this.getPeriodTime(scheduleEvent.periodStart, true)
    const endTime = this.getPeriodTime(scheduleEvent.periodEnd, false)

    const start = new Date(eventDate)
    start.setHours(Math.floor(startTime / 100), startTime % 100, 0, 0)

    const end = new Date(eventDate)
    end.setHours(Math.floor(endTime / 100), endTime % 100, 0, 0)

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

    return {
      summary: scheduleEvent.courseName,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'Asia/Taipei',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'Asia/Taipei',
      },
      // 移除地點欄位的自動輸入，改為空值或字串格式
      location: scheduleEvent.location || '',
      description,
      extendedProperties: {
        private: {
          source: 'class_sync',
          weekStart: weekStart.toISOString().split('T')[0],
          weekday: scheduleEvent.weekday.toString(),
          periodStart: scheduleEvent.periodStart.toString(),
          periodEnd: scheduleEvent.periodEnd.toString(),
          courseId: scheduleEvent.courseId || '',
          seriesId: scheduleEvent.seriesId || '',
        },
      },
    }
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