import { WeekSchedule, ScheduleEvent } from './types'

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDateRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 4) // Friday
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const start = weekStart.toLocaleDateString('zh-TW', options)
  const end = weekEnd.toLocaleDateString('zh-TW', options)
  
  return `${start} - ${end}`
}

export function initializeEmptySchedule(): WeekSchedule {
  const schedule: WeekSchedule = {}
  
  for (let day = 1; day <= 5; day++) {
    schedule[day] = {}
    for (let period = 1; period <= 8; period++) {
      schedule[day][period] = null
    }
  }
  
  return schedule
}

export function mergeAdjacentPeriods(events: ScheduleEvent[]): ScheduleEvent[] {
  if (events.length === 0) return []

  const eventsByDayAndCourse = new Map<string, ScheduleEvent[]>()

  // Group events by day and course
  events.forEach(event => {
    const key = `${event.weekday}-${event.courseId || event.courseName}`
    if (!eventsByDayAndCourse.has(key)) {
      eventsByDayAndCourse.set(key, [])
    }
    eventsByDayAndCourse.get(key)!.push(event)
  })

  const merged: ScheduleEvent[] = []

  // Merge adjacent periods for each group
  eventsByDayAndCourse.forEach(dayEvents => {
    dayEvents.sort((a, b) => a.periodStart - b.periodStart)
    
    let current = { ...dayEvents[0] }
    
    for (let i = 1; i < dayEvents.length; i++) {
      const next = dayEvents[i]
      
      // Check if periods are adjacent (skip lunch break between periods 4-5)
      const isAdjacent = (
        next.periodStart === current.periodEnd + 1 && 
        !(current.periodEnd === 4 && next.periodStart === 5)
      )
      
      if (isAdjacent) {
        current.periodEnd = next.periodEnd
      } else {
        // Handle cross-lunch break (split into morning and afternoon)
        if (current.periodEnd === 4 && next.periodStart === 5) {
          // Add morning session
          merged.push({ ...current })
          
          // Start afternoon session
          current = { ...next }
        } else {
          merged.push({ ...current })
          current = { ...next }
        }
      }
    }
    
    merged.push({ ...current })
  })

  return merged
}

export function validateScheduleData(schedule: WeekSchedule): string[] {
  const errors: string[] = []
  
  Object.keys(schedule).forEach(day => {
    const dayNum = parseInt(day)
    if (dayNum < 1 || dayNum > 5) {
      errors.push(`Invalid weekday: ${day}`)
    }
    
    Object.keys(schedule[dayNum]).forEach(period => {
      const periodNum = parseInt(period)
      if (periodNum < 1 || periodNum > 8) {
        errors.push(`Invalid period: ${period} on day ${day}`)
      }
    })
  })
  
  return errors
}