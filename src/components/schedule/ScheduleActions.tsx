'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Plus, Minus, Loader2 } from 'lucide-react'
import { ScheduleEvent } from '@/lib/types'

interface ScheduleActionsProps {
  onPreview: () => void
  onSync: () => void
  previewChanges?: {
    create: ScheduleEvent[]
    update: ScheduleEvent[]
    delete: string[]
  }
  isLoading?: boolean
}

export default function ScheduleActions({
  onPreview,
  onSync,
  previewChanges,
  isLoading = false
}: ScheduleActionsProps) {
  const totalChanges = previewChanges 
    ? previewChanges.create.length + previewChanges.update.length + previewChanges.delete.length
    : 0

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          onClick={onPreview}
          disabled={isLoading}
          className="w-full sm:w-auto gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          預覽同步
        </Button>
        
        <Button 
          onClick={onSync}
          disabled={isLoading || totalChanges === 0}
          className="gap-2 w-full sm:w-auto"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {isLoading ? '正在同步到 Google Calendar...' : '同步到 Google Calendar'}
          </span>
          <span className="sm:hidden">
            {isLoading ? '同步中...' : '同步'}
          </span>
        </Button>
      </div>

      {/* Loading Status */}
      {isLoading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">正在同步課表...</div>
                <div className="text-sm text-blue-700">請不要關閉頁面，等待同步完成</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Changes */}
      {previewChanges && totalChanges > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">預覽同步變更</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewChanges.create.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="gap-1">
                    <Plus className="w-3 h-3" />
                    新增 {previewChanges.create.length} 個事件
                  </Badge>
                </div>
                <div className="text-xs space-y-1 ml-2">
                  {previewChanges.create.map((event, index) => (
                    <div key={index} className="text-muted-foreground">
                      {event.courseName} - 第{event.periodStart}
                      {event.periodStart !== event.periodEnd && `-${event.periodEnd}`}節
                      {event.location && ` (${event.location})`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewChanges.update.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    更新 {previewChanges.update.length} 個事件
                  </Badge>
                </div>
              </div>
            )}

            {previewChanges.delete.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="gap-1">
                    <Minus className="w-3 h-3" />
                    刪除 {previewChanges.delete.length} 個事件
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}