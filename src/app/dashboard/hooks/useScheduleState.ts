'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WeekSchedule, ScheduleCell } from '@/lib/types'
import { getWeekStart, initializeEmptyScheduleWithWeekends } from '@/lib/schedule-utils'
import { loadLocalSchedule, saveLocalSchedule } from '@/lib/local-schedule'

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export interface UseScheduleStateReturn {
  // State
  currentWeek: Date | null
  schedule: WeekSchedule
  isLoadingSchedule: boolean
  pendingChanges: WeekSchedule | null
  isPreventingReload: boolean

  // Actions
  setWeek: (week: Date) => void
  setSchedule: (schedule: WeekSchedule | ((prev: WeekSchedule) => WeekSchedule)) => void
  loadWeekSchedule: (week: Date, skipSyncDeleted?: boolean, preserveLocalChanges?: boolean) => Promise<void>
  saveScheduleData: (weekStartStr: string, scheduleData: WeekSchedule) => Promise<void>
  markPendingChanges: (changes: WeekSchedule) => void
  clearPendingChanges: () => void
}

export function useScheduleState(): UseScheduleStateReturn {
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null)
  const [schedule, setSchedule] = useState<WeekSchedule>(initializeEmptyScheduleWithWeekends())
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<WeekSchedule | null>(null)
  const [isPreventingReload, setIsPreventingReload] = useState(false)

  // Refs to avoid stale closure in loadWeekSchedule
  const pendingChangesRef = useRef<WeekSchedule | null>(null)
  const isPreventingReloadRef = useRef(false)
  const currentWeekRef = useRef<Date | null>(null)

  // Sync refs with state
  useEffect(() => {
    pendingChangesRef.current = pendingChanges
  }, [pendingChanges])

  useEffect(() => {
    isPreventingReloadRef.current = isPreventingReload
  }, [isPreventingReload])

  useEffect(() => {
    currentWeekRef.current = currentWeek
  }, [currentWeek])

  // Initialize currentWeek on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentWeek(getWeekStart(new Date()))
  }, [])

  const saveScheduleData = useCallback(async (weekStartStr: string, scheduleData: WeekSchedule): Promise<void> => {
    console.log('💾 [SaveSchedule] Saving schedule data for week:', weekStartStr)
    console.log('💾 [SaveSchedule] Schedule data:', scheduleData)

    try {
      const requestBody = {
        weekStart: weekStartStr,
        data: scheduleData
      }

      console.log('💾 [SaveSchedule] Request body:', requestBody)

      const response = await fetch('/api/weeks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('💾 [SaveSchedule] Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.warn('💾 [SaveSchedule] Save failed:', response.status, errorText)
        throw new Error(`Save failed: ${response.status}`)
      } else {
        console.log('✅ [SaveSchedule] Schedule data saved successfully')
      }
    } catch (error) {
      console.warn('❌ [SaveSchedule] Save error:', error)
      throw error
    }
  }, [])

  const loadWeekSchedule = useCallback(async (
    week: Date,
    skipSyncDeleted = true, // 預設跳過 sync-deleted，減少不必要的 Google API 調用
    preserveLocalChanges = false
  ): Promise<void> => {
    const weekStartStr = formatDateLocal(week)
    const localSchedule = loadLocalSchedule(weekStartStr)

    // Use refs to get latest values and avoid stale closure
    const currentPendingChanges = pendingChangesRef.current
    const currentIsPreventingReload = isPreventingReloadRef.current
    const currentWeekValue = currentWeekRef.current

    // 如果有待處理的變更，則跳過載入以保護用戶輸入
    if (preserveLocalChanges && currentPendingChanges) {
      console.log('⏸️ [LoadSchedule] 跳過載入以保留本地變更')
      return
    }

    // 如果正在防止重載，也跳過載入（僅限同一週）
    const currentWeekStr = currentWeekValue ? formatDateLocal(currentWeekValue) : null
    if (currentIsPreventingReload && currentWeekStr === weekStartStr) {
      console.log('⏸️ [LoadSchedule] 正在防止重載，跳過載入')
      return
    }

    setIsLoadingSchedule(true)

    try {
      // 並行執行載入課表和同步刪除的事件（如果需要的話）
      const promises: Promise<Response>[] = [fetch(`/api/weeks/${weekStartStr}`)]

      if (!skipSyncDeleted) {
        promises.push(
          fetch(`/api/weeks/${weekStartStr}/sync-deleted`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => new Response('{}', { status: 500 })) // 不讓同步刪除失敗影響載入
        )
      }

      const [scheduleResponse, syncDeletedResponse] = await Promise.all(promises)

      // 處理課表載入
      if (scheduleResponse.ok) {
        const data = await scheduleResponse.json()
        if (data.schedule && Object.keys(data.schedule).length > 0) {
          // 確保載入的課表包含週末資料結構
          const fullSchedule = initializeEmptyScheduleWithWeekends()
          Object.keys(data.schedule).forEach(day => {
            const dayNum = parseInt(day)
            if (dayNum >= 1 && dayNum <= 7) {
              const daySchedule: { [period: number]: ScheduleCell | null } = {}
              Object.keys(data.schedule[dayNum] || {}).forEach(period => {
                const periodNum = parseInt(period)
                const cell = data.schedule[dayNum][periodNum]
                if (cell) {
                  daySchedule[periodNum] = {
                    ...cell,
                    calendarEventId: cell.calendarEventId
                  }
                }
              })
              fullSchedule[dayNum] = daySchedule
            }
          })

          // DB 永遠是 source of truth，localStorage 只作為 instant paint 的 read 來源
          setSchedule(fullSchedule)
          saveLocalSchedule(weekStartStr, fullSchedule)

          console.log(`載入 ${weekStartStr} 週課表:`, data.totalEvents || Object.keys(data.schedule).length, '個時段')
        } else {
          // 只在沒有資料時才設定空課表
          const empty = initializeEmptyScheduleWithWeekends()
          setSchedule(empty)
          saveLocalSchedule(weekStartStr, empty)
        }
      } else if (scheduleResponse.status === 404) {
        const empty = initializeEmptyScheduleWithWeekends()
        setSchedule(empty)
        saveLocalSchedule(weekStartStr, empty)
      } else {
        console.warn('載入週課表失敗:', scheduleResponse.status)
        // 載入失敗時不重設課表，保持現有狀態
      }

      // 處理同步刪除的結果（背景處理，不影響主要流程）
      if (syncDeletedResponse && syncDeletedResponse.ok) {
        const syncData = await syncDeletedResponse.json()
        if (syncData.deletedFromDb > 0) {
          console.log(`✅ [SyncDeleted] 已清理 ${syncData.deletedFromDb} 個在 Google Calendar 中已刪除的事件`)
        }
      }

    } catch (error) {
      console.error('載入週課表錯誤:', error)
      if (localSchedule) {
        setSchedule(localSchedule)
      } else {
        const empty = initializeEmptyScheduleWithWeekends()
        setSchedule(empty)
        saveLocalSchedule(weekStartStr, empty)
      }
    } finally {
      setIsLoadingSchedule(false)
    }
  }, []) // Empty dependency array - refs ensure we always have latest values

  const markPendingChanges = useCallback((changes: WeekSchedule) => {
    setPendingChanges(changes)
    setIsPreventingReload(true)
  }, [])

  const clearPendingChanges = useCallback(() => {
    setPendingChanges(null)
    setIsPreventingReload(false)
  }, [])

  const setWeek = useCallback((week: Date) => {
    setCurrentWeek(week)
  }, [])

  return {
    // State
    currentWeek,
    schedule,
    isLoadingSchedule,
    pendingChanges,
    isPreventingReload,

    // Actions
    setWeek,
    setSchedule,
    loadWeekSchedule,
    saveScheduleData,
    markPendingChanges,
    clearPendingChanges,
  }
}
