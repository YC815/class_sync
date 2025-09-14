'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Calendar, Plus, Minus, Loader2, ExternalLink, Check, X, AlertCircle, Menu } from 'lucide-react'
import { ScheduleEvent } from '@/lib/types'

interface FloatingSyncButtonProps {
  onSync: () => Promise<{ syncedEvents: number; deletedEvents: number; message: string }>
  onBaseView?: () => void
  isLoading?: boolean
}

export default function FloatingSyncButton({
  onSync,
  onBaseView,
  isLoading = false
}: FloatingSyncButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [syncStep, setSyncStep] = useState<'syncing' | 'success' | 'error'>('syncing')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ syncedEvents: number; deletedEvents: number; message: string } | null>(null)


  const handleSyncClick = async () => {
    setShowDialog(true)
    setSyncStep('syncing')
    setSyncError(null)
    setSyncResult(null)

    // 直接開始同步
    try {
      const result = await onSync()
      setSyncResult(result)
      setSyncStep('success')
    } catch (error) {
      setSyncStep('error')
      setSyncError(error instanceof Error ? error.message : '同步失敗')
    }
  }


  const openGoogleCalendar = () => {
    window.open('https://calendar.google.com', '_blank')
  }

  return (
    <>
      {/* Mobile View: Hamburger menu in the bottom-right corner */}
      <div className="md:hidden fixed bottom-6 right-6 z-40 pb-safe pr-safe">
        <div className="relative">
          {/* Expanded menu options */}
          <div className={`absolute bottom-0 right-16 space-y-3 mr-2 transition-all duration-300 ease-in-out transform origin-bottom-right ${
            showMenu
              ? 'opacity-100 scale-100 translate-x-0'
              : 'opacity-0 scale-75 translate-x-4 pointer-events-none'
          }`}>
            {onBaseView && (
              <div className={`flex items-center justify-end transition-all duration-300 ease-in-out ${
                showMenu ? 'opacity-100 translate-x-0 delay-100' : 'opacity-0 translate-x-4'
              }`}>
                <div className="bg-gray-800/95 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm mr-3 shadow-lg whitespace-nowrap">
                  檢視基地
                </div>
                <Button
                  onClick={() => {
                    if (onBaseView) onBaseView()
                    setShowMenu(false)
                  }}
                  disabled={isLoading}
                  className="w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-transform duration-300 bg-green-600 hover:bg-green-700 hover:scale-110 p-0"
                  size="lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </Button>
              </div>
            )}
            <div className={`flex items-center justify-end transition-all duration-300 ease-in-out ${
              showMenu ? 'opacity-100 translate-x-0 delay-150' : 'opacity-0 translate-x-4'
            }`}>
              <div className="bg-gray-800/95 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm mr-3 shadow-lg whitespace-nowrap">
                同步到 Google Calendar
              </div>
              <Button
                onClick={() => {
                  handleSyncClick()
                  setShowMenu(false)
                }}
                disabled={isLoading}
                className="w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-transform duration-300 bg-blue-600 hover:bg-blue-700 hover:scale-110 p-0"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Calendar className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Main hamburger menu button */}
          <Button
            onClick={() => setShowMenu(!showMenu)}
            className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-[colors,box-shadow] duration-300 ease-in-out bg-gray-900 hover:bg-gray-800 active:translate-y-0 p-0"
            size="lg"
          >
            <div className={`transition-all duration-300 ease-in-out ${
              showMenu ? 'transform rotate-45' : 'transform rotate-0'
            }`}>
              <Menu className={`w-6 h-6 transition-all duration-300 ease-in-out ${
                showMenu ? 'stroke-blue-300' : 'stroke-white'
              }`} />
            </div>
          </Button>
        </div>
      </div>

      {/* Click outside to close menu (for mobile) */}
      {showMenu && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Desktop View: Centered, expanded buttons */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pb-safe items-center justify-center gap-4">
        {onBaseView && (
          <Button
            onClick={onBaseView}
            disabled={isLoading}
            className="h-12 rounded-full shadow-lg hover:shadow-xl transition-transform duration-300 bg-green-600 hover:bg-green-700 hover:scale-105 gap-2 px-6"
            size="lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            檢視基地
          </Button>
        )}
        <Button
          onClick={handleSyncClick}
          disabled={isLoading}
          className="h-12 rounded-full shadow-lg hover:shadow-xl transition-transform duration-300 bg-blue-600 hover:bg-blue-700 hover:scale-105 gap-2 px-6"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Calendar className="w-5 h-5" />
          )}
          同步到 Google Calendar
        </Button>
      </div>

      {/* 同步對話框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">

          {syncStep === 'syncing' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  正在同步中...
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-blue-900">
                      正在從 Google Calendar 獲取最新資料並同步...
                    </div>
                    <div className="text-sm text-blue-700 mt-2">
                      請稍候，不要關閉此視窗
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {syncStep === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  同步成功！
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-green-900">
                      {syncResult?.message || `已成功同步 ${syncResult?.syncedEvents || 0} 個事件到 Google Calendar`}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={openGoogleCalendar}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    開啟 Google Calendar
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDialog(false)
                      setSyncStep('syncing')
                    }}
                    className="gap-2"
                  >
                    關閉
                  </Button>
                </div>
              </div>
            </>
          )}

          {syncStep === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  同步失敗
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="text-red-900 font-medium mb-2">
                      同步過程中發生錯誤
                    </div>
                    <div className="text-sm text-red-700">
                      {syncError || '未知錯誤'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  關閉
                </Button>
                <Button
                  onClick={handleSyncClick}
                  className="gap-2"
                >
                  重試
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
