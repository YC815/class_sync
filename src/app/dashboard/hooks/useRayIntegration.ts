'use client'

import { useState, useCallback } from 'react'

export interface UseRayIntegrationOptions {
  onSuccess?: () => Promise<void>
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
  onSuccess,
}: UseRayIntegrationOptions): UseRayIntegrationReturn {
  const [isRayDialogOpen, setIsRayDialogOpen] = useState(false)
  const [rayStep, setRayStep] = useState<'fetching' | 'success' | 'error'>('fetching')
  const [rayMessage, setRayMessage] = useState<string | null>(null)

  const handleRayFetch = useCallback(async (): Promise<void> => {
    console.log('🟡 [RaySync] handleRayFetch triggered — calling /api/ray/sync')
    setRayStep('fetching')
    setRayMessage(null)
    setIsRayDialogOpen(true)

    try {
      const response = await fetch('/api/ray/sync', { method: 'POST' })
      const data = await response.json()
      console.log('🟡 [RaySync] API response:', { status: response.status, ok: response.ok, data })

      if (!response.ok) {
        setRayMessage(data.message || '課表抓取失敗')
        setRayStep('error')
        return
      }

      setRayMessage(data.message)
      setRayStep('success')
      onSuccess?.()
    } catch (err) {
      console.error('🔴 [RaySync] fetch error:', err)
      setRayMessage('課表抓取失敗，請稍後再試')
      setRayStep('error')
    }
  }, [onSuccess])

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
