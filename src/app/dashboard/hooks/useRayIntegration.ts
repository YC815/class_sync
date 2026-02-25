'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { WeekSchedule } from '@/lib/types'

export interface UseRayIntegrationOptions {
  currentWeek: Date | null
  setSchedule: (schedule: WeekSchedule | ((prev: WeekSchedule) => WeekSchedule)) => void
  markPendingChanges: (changes: WeekSchedule) => void
}

export interface UseRayIntegrationReturn {
  // State
  isRayDialogOpen: boolean
  rayStep: 'fetching' | 'success' | 'error'
  rayMessage: string | null

  // Actions
  setRayDialogOpen: (open: boolean) => void
  handleRayFetch: () => Promise<void>
  resetRayState: () => void
}

export function useRayIntegration({
  currentWeek,
  setSchedule,
  markPendingChanges,
}: UseRayIntegrationOptions): UseRayIntegrationReturn {
  const [isRayDialogOpen, setIsRayDialogOpen] = useState(false)
  const [rayStep, setRayStep] = useState<'fetching' | 'success' | 'error'>('fetching')
  const [rayMessage, setRayMessage] = useState<string | null>(null)

  const handleRayFetch = useCallback(async (): Promise<void> => {
    setRayStep('fetching')
    setRayMessage(null)
    setIsRayDialogOpen(true)

    try {
      const response = await fetch('/api/ray/sync', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        setRayMessage(data.message || '課表抓取失敗')
        setRayStep('error')
        return
      }

      setRayMessage(data.message)
      setRayStep('success')

      // 如果抓取成功且有課表資料，標記為待處理變更
      // Note: 實際的課表資料會在下次載入週次時從伺服器獲取
      // 這裡只需要通知使用者成功即可
    } catch {
      setRayMessage('課表抓取失敗，請稍後再試')
      setRayStep('error')
    }
  }, [])

  const setRayDialogOpen = useCallback((open: boolean): void => {
    setIsRayDialogOpen(open)
  }, [])

  const resetRayState = useCallback((): void => {
    setRayStep('fetching')
    setRayMessage(null)
  }, [])

  return {
    // State
    isRayDialogOpen,
    rayStep,
    rayMessage,

    // Actions
    setRayDialogOpen,
    handleRayFetch,
    resetRayState,
  }
}
