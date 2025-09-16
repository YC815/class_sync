import { WeekSchedule, ScheduleEvent } from './types'

// 學期計算功能 - 整合台灣學制邏輯
export function getSemester(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  let academicYear: number;
  let semesterNumber: 1 | 2;

  if (month >= 8) {
    // 8~12月 → 當年度，第一學期
    academicYear = year - 1911;
    semesterNumber = 1;
  } else if (month >= 2) {
    // 2~7月 → 前一年度，第二學期
    academicYear = (year - 1) - 1911;
    semesterNumber = 2;
  } else {
    // 1月 → 前一年度，第一學期
    academicYear = (year - 1) - 1911;
    semesterNumber = 1;
  }

  const semester = `${academicYear}-${semesterNumber}`;

  console.log(`[getSemester] 計算學期: ${date.toISOString().split('T')[0]} → ${semester}`);

  return semester;
}

// 計算學期週次
export function calculateAcademicWeek(date: Date = new Date(), semester?: string): number {
  const targetSemester = semester || getSemester(date);
  const [academicYearStr, semesterNumStr] = targetSemester.split('-');

  const academicYear = parseInt(academicYearStr, 10);
  const semesterNumber = parseInt(semesterNumStr, 10) as 1 | 2;
  const actualYear = academicYear + 1911;

  let semesterStartDate: Date;

  if (semesterNumber === 1) {
    // 第一學期：8月1日開始
    semesterStartDate = new Date(actualYear, 7, 1); // 8月1日 (月份0-based)
  } else {
    // 第二學期：2月1日開始
    semesterStartDate = new Date(actualYear, 1, 1); // 2月1日
  }

  // 計算從學期開始到指定日期的週數
  const diffTime = Math.abs(date.getTime() - semesterStartDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.max(1, Math.ceil(diffDays / 7));

  console.log(`[calculateAcademicWeek] 計算週次: 學期=${targetSemester}, 日期=${date.toISOString().split('T')[0]}, 週次=${weekNumber}`);

  return weekNumber;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days to subtract to get to Monday
  // If today is Sunday (0), we need to go back 6 days to get previous Monday
  // If today is Monday (1), we need to go back 0 days
  // If today is Tuesday (2), we need to go back 1 day, etc.
  const diff = day === 0 ? -6 : -(day - 1)
  
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  
  console.log('getWeekStart:', {
    inputDate: date.toISOString(),
    dayOfWeek: day,
    diff: diff,
    weekStart: d.toISOString()
  })
  
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

  // Always initialize all 7 days (1-7: Mon-Sun) - merged functionality
  for (let day = 1; day <= 7; day++) {
    schedule[day] = {}
    for (let period = 1; period <= 8; period++) {
      schedule[day][period] = null
    }
  }

  return schedule
}

// Legacy alias for backward compatibility
export function initializeEmptyScheduleWithWeekends(): WeekSchedule {
  return initializeEmptySchedule()
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
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 7) {
      errors.push(`Invalid weekday: ${day} (must be 1-7 for Mon-Sun)`)
    }
    
    if (schedule[dayNum]) {
      Object.keys(schedule[dayNum]).forEach(period => {
        const periodNum = parseInt(period)
        if (isNaN(periodNum) || periodNum < 1 || periodNum > 8) {
          errors.push(`Invalid period: ${period} on day ${day} (must be 1-8)`)
        }
      })
    }
  })
  
  return errors
}

// 新增：驗證和清理 ScheduleEvent
export function validateScheduleEvent(event: ScheduleEvent): string[] {
  const errors: string[] = []
  
  if (!event.weekday || event.weekday < 1 || event.weekday > 7) {
    errors.push(`Invalid weekday: ${event.weekday} (must be 1-7)`)
  }
  
  if (!event.periodStart || event.periodStart < 1 || event.periodStart > 8) {
    errors.push(`Invalid periodStart: ${event.periodStart} (must be 1-8)`)
  }
  
  if (!event.periodEnd || event.periodEnd < 1 || event.periodEnd > 8) {
    errors.push(`Invalid periodEnd: ${event.periodEnd} (must be 1-8)`)
  }
  
  if (event.periodStart > event.periodEnd) {
    errors.push(`periodStart (${event.periodStart}) cannot be greater than periodEnd (${event.periodEnd})`)
  }
  
  if (!event.courseName && !event.courseId) {
    errors.push('Course name or ID is required')
  }
  
  return errors
}

// Check if a schedule has weekend courses (Saturday=6, Sunday=7)
export function hasWeekendCourses(schedule: WeekSchedule): boolean {
  for (const day of [6, 7]) { // Saturday and Sunday
    if (schedule[day]) {
      for (const period of Object.keys(schedule[day])) {
        if (schedule[day][parseInt(period)]) {
          return true
        }
      }
    }
  }
  return false
}

// Check if a schedule has Saturday courses (Saturday=6)
export function hasSaturdayCourses(schedule: WeekSchedule): boolean {
  if (schedule[6]) {
    for (const period of Object.keys(schedule[6])) {
      if (schedule[6][parseInt(period)]) {
        return true
      }
    }
  }
  return false
}

// Check if a schedule has Sunday courses (Sunday=7)  
export function hasSundayCourses(schedule: WeekSchedule): boolean {
  if (schedule[7]) {
    for (const period of Object.keys(schedule[7])) {
      if (schedule[7][parseInt(period)]) {
        return true
      }
    }
  }
  return false
}