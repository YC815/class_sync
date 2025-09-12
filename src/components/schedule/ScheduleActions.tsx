'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Copy, Plus, Minus } from 'lucide-react'
import { ScheduleEvent } from '@/lib/types'

interface ScheduleActionsProps {
  onPreview: () => void
  onSync: () => void
  onCopyWeek: () => void
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
  onCopyWeek,
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
          className="w-full sm:w-auto"
        >
          預覽同步
        </Button>
        
        <Button 
          onClick={onSync}
          disabled={isLoading || totalChanges === 0}
          className="gap-2 w-full sm:w-auto"
        >
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline">同步到 Google Calendar</span>
          <span className="sm:hidden">同步</span>
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onCopyWeek}
          disabled={isLoading}
          className="gap-2 w-full sm:w-auto"
        >
          <Copy className="w-4 h-4" />
          <span className="hidden sm:inline">複製到下週</span>
          <span className="sm:hidden">複製</span>
        </Button>
      </div>

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