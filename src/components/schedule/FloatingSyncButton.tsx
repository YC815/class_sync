'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Calendar, Plus, Minus, Loader2, ExternalLink, Check, X, AlertCircle } from 'lucide-react'
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
      {/* 浮動按鈕組 - 固定於底部中央，支援 safe-area */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 pb-safe">
        <div className="flex gap-3">
          {onBaseView && (
            <Button
              onClick={onBaseView}
              disabled={isLoading}
              className="gap-2 px-4 py-3 h-12 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 bg-green-600 hover:bg-green-700 backdrop-blur-sm"
              size="lg"
              variant="default"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              檢視基地
            </Button>
          )}
          <Button
            onClick={handleSyncClick}
            disabled={isLoading}
            className="gap-2 px-6 py-3 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700 backdrop-blur-sm"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <Calendar className="w-5 h-5" />
                同步 Google Calendar
              </>
            )}
          </Button>
        </div>
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