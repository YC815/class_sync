'use client'

import React, { useState } from 'react'
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
import { WeekSchedule, Course, WEEKDAYS_WITH_WEEKENDS, PERIODS, PERIOD_TIMES } from '@/lib/types'
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

  // Always show all weekdays including weekends
  const currentWeekdays = WEEKDAYS_WITH_WEEKENDS
  
  const maxDayIndex = currentWeekdays.length - 1

  const goToPreviousDay = () => {
    setSelectedDay(prev => prev > 0 ? prev - 1 : maxDayIndex) // 循環到最後一天
  }

  const goToNextDay = () => {
    setSelectedDay(prev => prev < maxDayIndex ? prev + 1 : 0) // 循環到第一天
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
    <div className="space-y-4 md:hidden relative">
      {/* 浮空藥丸日期導航 */}
      <div className="sticky top-24 z-40 flex justify-center mb-6">
        <div className="bg-background/90 backdrop-blur-md border rounded-full shadow-lg p-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousDay}
            className="h-8 w-8 rounded-full p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className={`px-4 py-1 text-center min-w-32 ${
            selectedDay >= 5 ? 'bg-slate-100 rounded-lg' : ''
          }`}>
            <div className="text-sm font-semibold">
              {currentWeekdays[selectedDay]}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(getDateForDay(selectedDay))}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextDay}
            className="h-8 w-8 rounded-full p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 快速日期選擇 */}
      <Select 
        value={selectedDay.toString()} 
        onValueChange={(value) => setSelectedDay(parseInt(value))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {currentWeekdays.map((day, index) => {
            const isWeekend = index >= 5
            return (
              <SelectItem key={index} value={index.toString()} className={isWeekend ? 'bg-slate-50' : ''}>
                {day} {formatDate(getDateForDay(index))}
              </SelectItem>
            )
          })}
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
            {currentWeekdays.map((day, dayIndex) => {
              const daySchedule = schedule[dayIndex] || {}
              const hasClasses = Object.keys(daySchedule).length > 0
              
              // 檢查半天基地衝突
              const checkHalfDayConflict = (halfDay: 'morning' | 'afternoon') => {
                const periods = halfDay === 'morning' ? [1, 2, 3, 4] : [5, 6, 7, 8]
                const bases = new Set<string>()
                
                periods.forEach(period => {
                  const cell = daySchedule[period]
                  if (cell?.base && cell.base !== '線上' && cell.base !== '空') {
                    bases.add(cell.base)
                  }
                })
                
                return bases.size > 1
              }
              
              // 獲取半天基地顯示
              const getHalfDayBaseDisplay = (halfDay: 'morning' | 'afternoon') => {
                const periods = halfDay === 'morning' ? [1, 2, 3, 4] : [5, 6, 7, 8]
                const bases = new Set<string>()
                const baseRooms = new Map<string, Set<string>>()
                
                periods.forEach(period => {
                  const cell = daySchedule[period]
                  if (cell?.base && cell.base !== '線上' && cell.base !== '空') {
                    bases.add(cell.base)
                    if (cell.room) {
                      if (!baseRooms.has(cell.base)) {
                        baseRooms.set(cell.base, new Set())
                      }
                      baseRooms.get(cell.base)!.add(cell.room)
                    }
                  }
                })
                
                if (bases.size === 0) return ''
                if (bases.size === 1) {
                  const baseName = Array.from(bases)[0]
                  const rooms = baseRooms.get(baseName)
                  if (rooms && rooms.size === 1) {
                    return `${baseName} · ${Array.from(rooms)[0]}`
                  }
                  return baseName
                }
                
                return '基地衝突'
              }
              
              const morningConflict = checkHalfDayConflict('morning')
              const afternoonConflict = checkHalfDayConflict('afternoon')
              const morningBase = getHalfDayBaseDisplay('morning')
              const afternoonBase = getHalfDayBaseDisplay('afternoon')
              
              return (
                <div key={dayIndex} className="space-y-1">
                  <div className="flex items-center justify-between py-1">
                    <span className={`text-sm font-medium w-12 ${
                      dayIndex >= 5 ? 'text-slate-600' : ''
                    }`}>{day}</span>
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
                  {/* 基地資訊顯示 */}
                  {(morningBase || afternoonBase) && (
                    <div className="flex gap-2 text-xs ml-14">
                      {morningBase && (
                        <div className={`px-2 py-1 rounded ${
                          morningConflict 
                            ? 'border border-red-500 text-red-700 bg-red-50' 
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          上午: {morningBase}
                        </div>
                      )}
                      {afternoonBase && (
                        <div className={`px-2 py-1 rounded ${
                          afternoonConflict 
                            ? 'border border-red-500 text-red-700 bg-red-50' 
                            : 'bg-green-50 text-green-700'
                        }`}>
                          下午: {afternoonBase}
                        </div>
                      )}
                    </div>
                  )}
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