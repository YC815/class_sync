'use client'

import { useState, useCallback } from 'react'

export interface AuthError {
  type: 'reauth_required' | 'auth_error' | 'token_expired'
  message: string
}

export function useAuthErrorHandler() {
  const [authError, setAuthError] = useState<AuthError | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleAuthError = useCallback((error: any) => {
    console.error('Auth error detected:', error)

    let authErrorInfo: AuthError

    // 檢查是否為 API 回應錯誤
    if (error?.response?.status === 401) {
      const errorData = error.response.data

      if (errorData?.error === 'reauth_required') {
        authErrorInfo = {
          type: 'reauth_required',
          message: errorData.message || '需要重新認證 Google 帳戶'
        }
      } else {
        authErrorInfo = {
          type: 'token_expired',
          message: errorData.message || '登入狀態已過期'
        }
      }
    } else if (error?.status === 401) {
      // 直接的 Response 物件
      authErrorInfo = {
        type: 'reauth_required',
        message: '認證已過期，請重新登入'
      }
    } else {
      // 其他類型的錯誤
      authErrorInfo = {
        type: 'auth_error',
        message: error?.message || '發生認證錯誤'
      }
    }

    setAuthError(authErrorInfo)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setAuthError(null)
  }, [])

  const checkApiResponse = useCallback(async (response: Response) => {
    if (response.status === 401) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: 'unauthorized', message: '認證失敗' }
      }

      handleAuthError({
        response: {
          status: 401,
          data: errorData
        }
      })
      return false
    }
    return true
  }, [handleAuthError])

  return {
    authError,
    isModalOpen,
    handleAuthError,
    closeModal,
    checkApiResponse
  }
}