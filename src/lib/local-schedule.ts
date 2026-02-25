import { WeekSchedule } from './types'

const STORAGE_PREFIX = 'schedule-'
const SCHEMA_VERSION = '1' // Schema 版本號，用於處理資料結構變更

interface StoredSchedule {
  version: string
  data: WeekSchedule
  timestamp: number
}

export function loadLocalSchedule(weekStart: string): WeekSchedule | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${weekStart}`)
    if (!stored) return null
    
    const parsed: StoredSchedule = JSON.parse(stored)
    
    // 檢查版本號，如果版本不符則視為無效資料
    if (parsed.version !== SCHEMA_VERSION) {
      console.log(`[localSchedule] Schema version mismatch: ${parsed.version} !== ${SCHEMA_VERSION}, clearing old data`)
      window.localStorage.removeItem(`${STORAGE_PREFIX}${weekStart}`)
      return null
    }
    
    return parsed.data
  } catch {
    // 如果解析失敗（可能是舊格式），清除該項目
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${weekStart}`)
    } catch {
      // Ignore cleanup errors
    }
    return null
  }
}

export function saveLocalSchedule(weekStart: string, schedule: WeekSchedule): void {
  if (typeof window === 'undefined') return
  try {
    const stored: StoredSchedule = {
      version: SCHEMA_VERSION,
      data: schedule,
      timestamp: Date.now()
    }
    window.localStorage.setItem(`${STORAGE_PREFIX}${weekStart}`, JSON.stringify(stored))
  } catch {
    // Ignore write errors (e.g., storage full)
  }
}
