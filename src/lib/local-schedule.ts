import { WeekSchedule } from './types'

const STORAGE_PREFIX = 'schedule-'

export function loadLocalSchedule(weekStart: string): WeekSchedule | null {
  if (typeof window === 'undefined') return null
  try {
    const data = window.localStorage.getItem(`${STORAGE_PREFIX}${weekStart}`)
    return data ? (JSON.parse(data) as WeekSchedule) : null
  } catch {
    return null
  }
}

export function saveLocalSchedule(weekStart: string, schedule: WeekSchedule): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${weekStart}`, JSON.stringify(schedule))
  } catch {
    // Ignore write errors
  }
}
