'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { X, RefreshCw, LogIn, AlertTriangle } from 'lucide-react'

interface AuthErrorModalProps {
  isOpen: boolean
  onClose: () => void
  error: {
    type: 'reauth_required' | 'auth_error' | 'token_expired'
    message: string
  }
  onRetry?: () => void
}

export function AuthErrorModal({ isOpen, onClose, error, onRetry }: AuthErrorModalProps) {
  const [isReauthenticating, setIsReauthenticating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // 阻止背景滾動
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleReauth = async () => {
    setIsReauthenticating(true)
    try {
      // 使用 NextAuth 重新登入，強制要求同意畫面
      await signIn('google', {
        callbackUrl: window.location.href,
        prompt: 'consent' // 強制顯示同意畫面以獲取新的 refresh token
      })
    } catch (error) {
      console.error('重新認證失敗:', error)
      setIsReauthenticating(false)
    }
  }

  const handleRetry = () => {
    onClose()
    if (onRetry) {
      onRetry()
    }
  }

  const getErrorConfig = () => {
    switch (error.type) {
      case 'reauth_required':
        return {
          title: 'Google 帳戶需要重新連結',
          description: 'Google 授權已過期或失效，請重新連結您的 Google 帳戶以繼續使用同步功能。',
          icon: <LogIn className="w-6 h-6 text-blue-500" />,
          primaryAction: {
            label: '重新連結 Google 帳戶',
            onClick: handleReauth,
            loading: isReauthenticating,
            className: 'bg-blue-600 hover:bg-blue-700 text-white'
          },
          secondaryAction: {
            label: '稍後處理',
            onClick: onClose,
            className: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          }
        }
      case 'token_expired':
        return {
          title: '登入狀態已過期',
          description: '您的登入狀態已過期，請重新登入以繼續使用。',
          icon: <RefreshCw className="w-6 h-6 text-orange-500" />,
          primaryAction: {
            label: '重新登入',
            onClick: handleReauth,
            loading: isReauthenticating,
            className: 'bg-orange-600 hover:bg-orange-700 text-white'
          },
          secondaryAction: {
            label: '取消',
            onClick: onClose,
            className: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          }
        }
      case 'auth_error':
      default:
        return {
          title: '認證錯誤',
          description: '發生認證錯誤，請稍後重試或重新登入。',
          icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
          primaryAction: onRetry ? {
            label: '重試',
            onClick: handleRetry,
            className: 'bg-green-600 hover:bg-green-700 text-white'
          } : {
            label: '重新登入',
            onClick: handleReauth,
            loading: isReauthenticating,
            className: 'bg-red-600 hover:bg-red-700 text-white'
          },
          secondaryAction: {
            label: '取消',
            onClick: onClose,
            className: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          }
        }
    }
  }

  const config = getErrorConfig()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 彈出視窗 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 內容 */}
        <div className="p-6">
          {/* 圖示和標題 */}
          <div className="flex items-center space-x-3 mb-4">
            {config.icon}
            <h3 className="text-lg font-semibold text-gray-900">
              {config.title}
            </h3>
          </div>

          {/* 描述 */}
          <p className="text-gray-600 mb-2">
            {config.description}
          </p>

          {/* 錯誤訊息 */}
          <div className="bg-gray-50 rounded-md p-3 mb-6">
            <p className="text-sm text-gray-700">
              <span className="font-medium">詳細訊息：</span>
              {error.message}
            </p>
          </div>

          {/* 操作按鈕 */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-3 space-y-reverse sm:space-y-0">
            <button
              onClick={config.secondaryAction.onClick}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${config.secondaryAction.className}`}
            >
              {config.secondaryAction.label}
            </button>

            <button
              onClick={config.primaryAction.onClick}
              disabled={config.primaryAction.loading}
              className={`px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${config.primaryAction.className}`}
            >
              {config.primaryAction.loading && (
                <RefreshCw className="w-4 h-4 animate-spin" />
              )}
              <span>{config.primaryAction.label}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}