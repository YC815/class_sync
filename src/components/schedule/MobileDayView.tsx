'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { WeekSchedule, Course, WEEKDAYS, PERIODS, PERIOD_TIMES } from '@/lib/types'
import AddTempCourseDialog from './AddTempCourseDialog'

interface MobileDayViewProps {
  schedule: WeekSchedule
  courses: Course[]
  onScheduleChange: (newSchedule: WeekSchedule) => void
  currentWeek: Date
}

export default function MobileDayView({
  schedule,
  courses,
  onScheduleChange,
  currentWeek
}: MobileDayViewProps) {
  const [selectedDay, setSelectedDay] = useState<number>(0) // 0 = 週一
  const [tempCourseDialog, setTempCourseDialog] = useState({
    open: false,
    weekday: 0,
    period: 1
  })

  const goToPreviousDay = () => {
    setSelectedDay(prev => prev > 0 ? prev - 1 : 4) // 循環到週五
  }

  const goToNextDay = () => {
    setSelectedDay(prev => prev < 4 ? prev + 1 : 0) // 循環到週一
  }

  const getDateForDay = (dayIndex: number) => {
    const date = new Date(currentWeek)
    date.setDate(currentWeek.getDate() + dayIndex)
    return date
  }

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const handleAddTempCourse = (courseName: string) => {
    if (!courseName.trim()) return

    const newSchedule = { ...schedule }
    if (!newSchedule[tempCourseDialog.weekday]) {
      newSchedule[tempCourseDialog.weekday] = {}
    }
    
    newSchedule[tempCourseDialog.weekday][tempCourseDialog.period] = {
      courseName: courseName.trim(),
      isTemporary: true
    }
    
    onScheduleChange(newSchedule)
    setTempCourseDialog({ open: false, weekday: 0, period: 1 })
  }

  const daySchedule = schedule[selectedDay] || {}

  return (
    <div className="space-y-4 md:hidden">
      {/* 日期導航 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-center">
              <div className="text-lg font-semibold">
                {WEEKDAYS[selectedDay]}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(getDateForDay(selectedDay))}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextDay}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 快速日期選擇 */}
      <Select 
        value={selectedDay.toString()} 
        onValueChange={(value) => setSelectedDay(parseInt(value))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WEEKDAYS.map((day, index) => (
            <SelectItem key={index} value={index.toString()}>
              {day} {formatDate(getDateForDay(index))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 當日課程列表 */}
      <div className="space-y-2">
        {PERIODS.map((period) => {
          const cell = daySchedule[period]
          
          return (
            <Card key={period} className="relative">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>第{period}節</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {PERIOD_TIMES[period as keyof typeof PERIOD_TIMES]}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {cell ? (
                  <div className="space-y-1">
                    <div className="font-medium">{cell.courseName}</div>
                    {cell.location && (
                      <div className="text-sm text-muted-foreground">
                        {cell.location}
                      </div>
                    )}
                    {cell.url && (
                      <a
                        href={cell.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:underline block"
                      >
                        課程連結
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTempCourseDialog({
                        open: true,
                        weekday: selectedDay,
                        period: period
                      })}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      新增課程
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 週課程總覽 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">本週課程總覽</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {WEEKDAYS.map((day, dayIndex) => {
              const daySchedule = schedule[dayIndex] || {}
              const hasClasses = Object.keys(daySchedule).length > 0
              
              return (
                <div key={dayIndex} className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium w-12">{day}</span>
                  <div className="flex-1 text-right">
                    {hasClasses ? (
                      <div className="text-xs text-muted-foreground">
                        {Object.entries(daySchedule)
                          .map(([period, cell]) => 
                            cell ? `第${period}節: ${cell.courseName}` : null
                          )
                          .filter(Boolean)
                          .join(', ')
                        }
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">無課程</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 新增課程對話框 */}
      <AddTempCourseDialog
        open={tempCourseDialog.open}
        onOpenChange={(open) => setTempCourseDialog(prev => ({ ...prev, open }))}
        onAddCourse={handleAddTempCourse}
      />
    </div>
  )
}