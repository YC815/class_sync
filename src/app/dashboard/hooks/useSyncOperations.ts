'use client'

import { useState, useCallback } from 'react'
import { mutate as globalMutate } from 'swr'
import { toast } from 'sonner'
import { signOut } from 'next-auth/react'

export interface UseSyncOperationsOptions {
  currentWeek: Date | null
  loadWeekSchedule: (week: Date, skipSyncDeleted?: boolean, preserveLocalChanges?: boolean) => Promise<void>
}

export interface UseSyncOperationsReturn {
  // State
  isSyncing: boolean
  syncError: string | null
  forceSyncStep: 'idle' | 'syncing' | 'success' | 'error'
  forceSyncMessage: string | null
  forceSyncProgress: { current: number; total: number; weekStart: string } | null

  // Actions
  handleSync: (weekStartStr: string, schedule: WeekSchedule) => Promise<{ syncedEvents: number; deletedEvents: number; message: string }>
  handleForceSync: () => void
  handleManualRecovery: () => Promise<void>
  resetForceSyncState: () => void
}

// Import types from existing files
import { WeekSchedule } from '@/lib/types'

// Local helper function (was in page.tsx)
async function saveScheduleData(weekStartStr: string, scheduleData: WeekSchedule): Promise<void> {
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
}

export function useSyncOperations({
  currentWeek,
  loadWeekSchedule,
}: UseSyncOperationsOptions): UseSyncOperationsReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [forceSyncStep, setForceSyncStep] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [forceSyncMessage, setForceSyncMessage] = useState<string | null>(null)
  const [forceSyncProgress, setForceSyncProgress] = useState<{ current: number; total: number; weekStart: string } | null>(null)

  const handleSync = useCallback(async (
    weekStartStr: string,
    schedule: WeekSchedule
  ): Promise<{ syncedEvents: number; deletedEvents: number; message: string }> => {
    if (!currentWeek) {
      console.log('🚫 [Sync] No current week selected')
      throw new Error('No current week selected')
    }

    console.log('🔄 [Sync] Starting sync for week:', weekStartStr)
    setIsSyncing(true)

    try {
      // Step 1: Save current schedule to DB
      console.log('💾 [Sync] Saving schedule data first')
      await saveScheduleData(weekStartStr, schedule)

      // Step 2: Sync all unsynced events across all weeks
      const response = await fetch('/api/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      console.log('📅 [Sync] sync-all response status:', response.status)

      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}))
        console.error('📅 [Sync] Unauthorized:', errorData)
        if (errorData.error === 'reauth_required') {
          throw new Error(`reauth_required:${errorData.message || '需要重新認證 Google 帳戶'}`)
        } else {
          toast.error('登入逾期，請重新登入')
          await signOut()
          throw new Error(errorData.error || 'Unauthorized')
        }
      }

      if (!response.ok) {
        const errorData = await response.json()
        console.error('📅 [Sync] Sync error response:', errorData)
        throw new Error(errorData.error || 'Sync failed')
      }

      const data = await response.json()
      console.log('✅ [Sync] Sync successful:', data)
      toast.success(data.message || '同步成功！')

      // 使用 SWR global mutate 失效所有週次快取，確保其他週的 isSynced 狀態正確
      // [CRITICAL FIX] 這是先前修復的 SWR global mutate 邏輯，必須保留
      await globalMutate(
        (key) => typeof key === 'string' && key.startsWith('/api/weeks/'),
        undefined,
        { revalidate: true }
      )
      console.log('🔄 [Sync] Invalidated all week caches via SWR global mutate')

      const syncedEvents = (data.created || 0) + (data.linked || 0) + (data.replaced || 0)
      return {
        syncedEvents,
        deletedEvents: data.replaced || 0,
        message: data.message || '同步成功！'
      }
    } catch (error) {
      console.error('❌ [Sync] Sync failed:', error)
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      toast.error(`同步失敗：${errorMessage}`)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [currentWeek])

  const handleForceSync = useCallback(async (): Promise<void> => {
    setForceSyncStep('syncing')
    setForceSyncMessage(null)
    setForceSyncProgress(null)
    setIsSyncing(true)

    try {
      // Step 1: Get list of weeks to process
      const weeksRes = await fetch('/api/force-sync-all/weeks')
      if (weeksRes.status === 401) {
        setForceSyncStep('idle')
        toast.error('登入逾期，請重新登入')
        await signOut()
        return
      }
      if (!weeksRes.ok) {
        setForceSyncStep('error')
        setForceSyncMessage('無法取得週清單，請重試')
        return
      }
      const { weeks } = await weeksRes.json() as { weeks: string[] }

      if (weeks.length === 0) {
        setForceSyncStep('success')
        setForceSyncMessage('今天以後沒有任何事件需要同步')
        return
      }

      // Step 2: Process each week sequentially
      let totalDeleted = 0
      let totalCreated = 0
      let totalErrors = 0

      for (let i = 0; i < weeks.length; i++) {
        const weekStart = weeks[i]
        setForceSyncProgress({ current: i + 1, total: weeks.length, weekStart })

        const res = await fetch(`/api/weeks/${weekStart}/force-sync`, { method: 'POST' })
        const data = await res.json().catch(() => ({}))

        if (res.status === 401) {
          setForceSyncStep('idle')
          if (data.error === 'reauth_required') {
            toast.error(data.message || '需要重新認證 Google 帳戶')
          } else {
            toast.error('登入逾期，請重新登入')
            await signOut()
          }
          return
        }

        if (!res.ok) {
          setForceSyncStep('error')
          setForceSyncMessage(`第 ${i + 1} 週（${weekStart}）失敗：${data.error || '未知錯誤'}`)
          return
        }

        totalDeleted += data.deleted ?? 0
        totalCreated += data.created ?? 0
        totalErrors += data.errors ?? 0
      }

      setForceSyncStep('success')
      setForceSyncMessage(
        `強制重新同步完成（${weeks.length} 週，刪除 ${totalDeleted}，新建 ${totalCreated}${totalErrors > 0 ? `，失敗 ${totalErrors}` : ''}）`
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      setForceSyncStep('error')
      setForceSyncMessage(errorMessage)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const handleManualRecovery = useCallback(async (): Promise<void> => {
    if (!currentWeek) {
      toast.error('請先選擇週次')
      return
    }

    setIsSyncing(true)
    try {
      const weekStartStr = formatDateLocal(currentWeek)
      const response = await fetch(`/api/weeks/${weekStartStr}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.recoveredEvents > 0 || data.linkedEvents > 0) {
          toast.success(data.message)
          // Reload the schedule to show recovered events, but preserve local changes
          await loadWeekSchedule(currentWeek, true, true) // Skip sync-deleted and preserve local changes
        } else {
          toast.info(data.message)
        }
      } else if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.code === 'TOKEN_EXPIRED') {
          toast.error('Google Calendar 權限已過期，請重新登入')
          await signOut()
        } else {
          toast.error('權限不足，請重新登入')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || '恢復失敗，請重試')
      }
    } catch (error) {
      console.error('Manual recovery failed:', error)
      toast.error('恢復失敗，請檢查網路連線')
    } finally {
      setIsSyncing(false)
    }
  }, [currentWeek, loadWeekSchedule])

  const resetForceSyncState = useCallback((): void => {
    setForceSyncStep('idle')
    setForceSyncMessage(null)
    setForceSyncProgress(null)
  }, [])

  return {
    // State
    isSyncing,
    syncError,
    forceSyncStep,
    forceSyncMessage,
    forceSyncProgress,

    // Actions
    handleSync,
    handleForceSync,
    handleManualRecovery,
    resetForceSyncState,
  }
}

// Helper function (copied from page.tsx)
function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}