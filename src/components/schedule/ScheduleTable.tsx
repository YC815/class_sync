'use client'

import React, { useState, useMemo } from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import AddTempCourseDialog from './AddTempCourseDialog'
import { 
  WeekSchedule, 
  Course, 
  Base,
  ScheduleCell, 
  WEEKDAYS_WITH_WEEKENDS,
  PERIODS, 
  PERIOD_TIMES
} from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ScheduleTableProps {
  schedule: WeekSchedule
  courses: Course[]
  bases: Base[]
  onScheduleChange: (schedule: WeekSchedule) => void
  currentWeek: Date
}

export default function ScheduleTable({
  schedule,
  courses,
  bases,
  onScheduleChange,
  currentWeek
}: ScheduleTableProps) {
  const [tempCourseDialog, setTempCourseDialog] = useState<{open: boolean, day: number, period: number}>({
    open: false,
    day: 0,
    period: 0
  })
  
  // Mobile: track selected day (1-7)
  const [selectedDay, setSelectedDay] = useState(1)


  // Calculate dates for each weekday (including weekends) - memoized to prevent recalculation
  const weekdayDates = useMemo(() => {
    return WEEKDAYS_WITH_WEEKENDS.map((_, index) => {
      const date = new Date(currentWeek)
      date.setDate(currentWeek.getDate() + index)
      return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    })
  }, [currentWeek])
  // Always show all weekdays including weekends
  const currentWeekdays = WEEKDAYS_WITH_WEEKENDS
  
  // Weekend initialization is now handled at the parent level to prevent flickers
  const updateCell = (day: number, period: number, data: ScheduleCell | null) => {
    const newSchedule = { ...schedule }
    if (!newSchedule[day]) {
      newSchedule[day] = {}
    }
    newSchedule[day] = { ...newSchedule[day], [period]: data }
    onScheduleChange(newSchedule)
  }

  // 新增一個批次更新函數，可以同時更新多個 cell
  const updateMultipleCells = (updates: Array<{ day: number, period: number, data: ScheduleCell | null }>) => {
    const newSchedule = { ...schedule }

    updates.forEach(({ day, period, data }) => {
      if (!newSchedule[day]) {
        newSchedule[day] = {}
      }
      newSchedule[day] = { ...newSchedule[day], [period]: data }
    })

    onScheduleChange(newSchedule)
  }

  const getCellContent = (day: number, period: number) => {
    const cell = schedule[day]?.[period]
    if (!cell) return null

    const course = courses.find(c => c.id === cell.courseId)
    const displayName = cell.courseName || course?.name || '未知課程'

    return (
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium">
          {displayName}
        </span>
      </div>
    )
  }

  const handleCourseSelect = (day: number, period: number, courseId: string) => {
    if (courseId === 'none' || courseId === '') {
      updateCell(day, period, null)

      // 如果是奇數節次且下一節是連堂，清除下一節
      const isOddPeriod = period % 2 === 1
      const nextPeriod = period + 1
      const nextCell = schedule[day]?.[nextPeriod]
      if (isOddPeriod && nextCell?.isContinuation) {
        updateCell(day, nextPeriod, null)
      }
      return
    }

    if (courseId === 'other') {
      setTempCourseDialog({
        open: true,
        day,
        period
      })
      return
    }

    if (courseId === 'continuation') {
      // 處理連堂選項
      const previousPeriod = period - 1
      const previousCell = schedule[day]?.[previousPeriod]
      if (previousCell) {
        updateCell(day, period, {
          ...previousCell,
          isContinuation: true,
          calendarEventId: undefined
        })
      }
      return
    }


    const course = courses.find(c => c.id === courseId)
    if (course) {
      const currentCell = schedule[day]?.[period]
      const updates: Array<{ day: number, period: number, data: ScheduleCell | null }> = [
        {
          day,
          period,
          data: {
            courseId: course.id,
            courseName: course.name,
            base: currentCell?.base, // 保持基地選擇不變
            room: currentCell?.room, // 保持教室選擇不變
            placeId: currentCell?.placeId,
            address: currentCell?.address,
            calendarEventId: undefined
          }
        }
      ]

      // 如果是奇數節次且下一節是連堂，清除下一節
      const isOddPeriod = period % 2 === 1
      const nextPeriod = period + 1
      const nextCell = schedule[day]?.[nextPeriod]
      if (isOddPeriod && nextCell?.isContinuation) {
        updates.push({
          day,
          period: nextPeriod,
          data: null
        })
      }

      updateMultipleCells(updates)
    }
  }

  const handleBaseSelect = (day: number, period: number, baseId: string) => {
    const currentCell = schedule[day]?.[period]
    if (!currentCell) return

    const base = bases.find(b => b.id === baseId)

    const updates: Array<{ day: number, period: number, data: ScheduleCell | null }> = [
      {
        day,
        period,
        data: {
          ...currentCell,
          base: baseId === 'none' ? undefined : base?.name,
          room: undefined, // 重設教室選擇
          placeId: baseId === 'none' ? undefined : base?.placeId || undefined,
          address: baseId === 'none' ? undefined : base?.address || undefined,
          calendarEventId: undefined
        }
      }
    ]

    // 如果是奇數節次且下一節是連堂，清除下一節
    const isOddPeriod = period % 2 === 1
    const nextPeriod = period + 1
    const nextCell = schedule[day]?.[nextPeriod]
    if (isOddPeriod && nextCell?.isContinuation) {
      updates.push({
        day,
        period: nextPeriod,
        data: null
      })
    }

    updateMultipleCells(updates)
  }

  const handleRoomSelect = (day: number, period: number, room: string) => {
    const currentCell = schedule[day]?.[period]
    if (!currentCell) return

    const updates: Array<{ day: number, period: number, data: ScheduleCell | null }> = [
      {
        day,
        period,
        data: {
          ...currentCell,
          room: room === 'none' ? undefined : room,
          calendarEventId: undefined
        }
      }
    ]

    // 如果是奇數節次且下一節是連堂，清除下一節
    const isOddPeriod = period % 2 === 1
    const nextPeriod = period + 1
    const nextCell = schedule[day]?.[nextPeriod]
    if (isOddPeriod && nextCell?.isContinuation) {
      updates.push({
        day,
        period: nextPeriod,
        data: null
      })
    }

    updateMultipleCells(updates)
  }

  const handleAddTempCourse = (courseName: string) => {
    const { day, period } = tempCourseDialog

    updateCell(day, period, {
      courseName,
      isTemporary: true,
      base: undefined,
      room: undefined,
      calendarEventId: undefined
    })
  }

  // 檢查半天基地衝突（桌機用）
  const checkHalfDayBaseConflict = (day: number, halfDay: 'morning' | 'afternoon') => {
    const periods = halfDay === 'morning' ? [1, 2, 3, 4] : [5, 6, 7, 8]
    const bases = new Set<string>()
    
    periods.forEach(period => {
      const cell = schedule[day]?.[period]
      if (cell?.base && cell.base !== '線上' && cell.base !== '空') {
        bases.add(cell.base)
      }
    })
    
    return bases.size > 1 // 有多於一個實體基地表示衝突
  }

  // 獲取半天基地顯示文字
  const getHalfDayBaseDisplay = (day: number, halfDay: 'morning' | 'afternoon') => {
    const periods = halfDay === 'morning' ? [1, 2, 3, 4] : [5, 6, 7, 8]
    const bases = new Set<string>()
    
    periods.forEach(period => {
      const cell = schedule[day]?.[period]
      if (cell?.base && cell.base !== '線上' && cell.base !== '空') {
        bases.add(cell.base)
      }
    })
    
    if (bases.size === 0) return ''
    if (bases.size === 1) {
      return Array.from(bases)[0]
    }
    
    return '基地衝突'
  }

  // 輔助函數：獲取課程選擇器的 value
  const getCourseSelectValue = (cell: ScheduleCell | null | undefined): string => {
    if (cell?.isContinuation) return 'continuation'
    if (cell?.courseId) return cell.courseId
    if (cell?.isTemporary && cell?.courseName) return 'temp'
    return 'none'
  }

  // 輔助函數：檢查並渲染連堂選項（桌機版）
  const renderContinuationOption = (day: number, period: number) => {
    const isEvenPeriod = period % 2 === 0
    const previousPeriod = period - 1
    const previousCell = schedule[day]?.[previousPeriod]

    if (isEvenPeriod && previousCell) {
      const previousCourseName = previousCell.courseName ||
        courses.find(c => c.id === previousCell.courseId)?.name ||
        '未知課程'
      return (
        <SelectItem
          value="continuation"
          className="text-orange-600 font-medium"
        >
          連堂（{previousCourseName}）
        </SelectItem>
      )
    }
    return null
  }

  // 輔助函數：檢查並渲染連堂選項（行動版）
  const renderMobileContinuationOption = (period: number) => {
    const isEvenPeriod = period % 2 === 0
    const previousPeriod = period - 1
    const previousCell = schedule[selectedDay]?.[previousPeriod]

    if (isEvenPeriod && previousCell) {
      const previousCourseName = previousCell.courseName ||
        courses.find(c => c.id === previousCell.courseId)?.name ||
        '未知課程'
      return (
        <SelectItem
          value="continuation"
          className="text-orange-600 font-medium"
        >
          連堂（{previousCourseName}）
        </SelectItem>
      )
    }
    return null
  }

  // 輔助函數：獲取基地選擇器的 value
  const getBaseSelectValue = (cell: ScheduleCell | null | undefined): string => {
    if (!cell?.base) return 'none'
    const base = bases.find(b => b.name === cell.base)
    return base?.id || 'none'
  }

  // 輔助函數：獲取教室選擇器的 value
  const getRoomSelectValue = (cell: ScheduleCell | null | undefined): string => {
    return cell?.room || 'none'
  }

  // 輔助函數：渲染教室選擇器或佔位符
  const renderRoomSelect = (day: number, period: number, cell: ScheduleCell | null | undefined) => {
    if (!cell || !cell.base) {
      // 沒有課程或基地時保留空間但不顯示選擇器
      return <div className="h-11 sm:h-6"></div>
    }
    
    const base = bases.find(b => b.name === cell.base)
    if (!base || base.isSingleRoom || !base.rooms || base.rooms.length === 0) {
      // 單一教室基地或沒有教室時保留空間但不顯示選擇器
      return <div className="h-11 sm:h-6"></div>
    }
    
    return (
      <Select
        value={cell.room || 'none'}
        onValueChange={(value) => handleRoomSelect(day, period, value)}
      >
        <SelectTrigger className="w-full min-h-11 sm:h-6 text-xs items-start">
          <SelectValue placeholder="選擇教室" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">無教室</SelectItem>
          {base.rooms.map(room => (
            <SelectItem key={room.id} value={room.name}>
              {room.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="space-y-4">
      {/* 同步狀態圖例 */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
        <span className="font-medium text-gray-700">同步狀態：</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border-l-4 border-green-400 rounded-sm"></div>
          <span className="text-green-700">已同步至 Google Calendar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border-l-4 border-yellow-400 rounded-sm border-dashed border-r border-t border-b"></div>
          <span className="text-yellow-700">本地編輯，尚未同步</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-300 border-dashed rounded-sm"></div>
          <span className="text-gray-600">空白時段</span>
        </div>
      </div>

      {/* Desktop: Schedule Table (hidden on mobile) */}
      <div className="hidden md:block border rounded-lg overflow-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center align-middle">節次</TableHead>
              <TableHead className="w-20 text-center text-xs align-middle">時間</TableHead>
              {currentWeekdays.map((day, index) => {
                const isWeekend = index >= 5 // 週六日

                return (
                  <TableHead key={index} className={`text-center min-w-32 px-2 align-middle ${
                    isWeekend ? 'bg-stone-300' : ''
                  }`}>
                    <div className="flex flex-col items-center">
                      <span>{day}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {weekdayDates[index]}
                      </span>
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 上午基地整理行 */}
            <TableRow className="bg-blue-50/50">
              <TableCell className="font-medium text-center text-blue-700">
                上午
              </TableCell>
              <TableCell className="text-xs text-blue-600">
                基地整理
              </TableCell>
              {currentWeekdays.map((_, index) => {
                const day = index + 1
                const morningBase = getHalfDayBaseDisplay(day, 'morning')
                const morningConflict = checkHalfDayBaseConflict(day, 'morning')
                const isWeekend = index >= 5

                return (
                  <TableCell key={`morning-base-${index}`} className={`text-center text-xs font-medium ${
                    isWeekend ? 'bg-gray-100' : ''
                  }`}>
                    <div className={`px-2 py-1 rounded ${
                      morningConflict
                        ? 'border border-red-500 text-red-700 bg-red-50'
                        : morningBase
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-400'
                    }`}>
                      {morningBase || '無'}
                    </div>
                  </TableCell>
                )
              })}
            </TableRow>
            {PERIODS.map(period => (
              <React.Fragment key={period}>
                <TableRow>
                  <TableCell className="font-medium text-center align-top">
                    {period}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground align-top">
                    {PERIOD_TIMES[period as keyof typeof PERIOD_TIMES]}
                  </TableCell>
                  {currentWeekdays.map((_, index) => {
                    const day = index + 1
                    const cell = schedule[day]?.[period]
                    const isWeekend = index >= 5

                    return (
                      <TableCell key={`${day}-${period}`} className={`p-1 sm:p-2 h-20 align-top ${
                        isWeekend ? 'bg-gray-50' : ''
                      } ${
                        !!cell?.calendarEventId
                          ? 'bg-green-50 border-l-4 border-green-400'
                          : cell
                            ? 'bg-yellow-50 border-l-4 border-yellow-400'
                            : ''
                      }`}>
                        <div className="space-y-1 h-full flex flex-col justify-start">
                          <Select
                            value={getCourseSelectValue(cell)}
                            onValueChange={(value) => handleCourseSelect(day, period, value)}
                          >
                            <SelectTrigger className={`w-full h-auto min-h-11 sm:min-h-8 text-xs items-start ${
                              !!cell?.calendarEventId
                                ? 'border-green-300 bg-green-50'
                                : cell
                                  ? 'border-yellow-300 bg-yellow-50 border-dashed'
                                  : 'border-dashed'
                            }`}>
                              <SelectValue>
                                {cell ? getCellContent(day, period) : (
                                  <span className="text-muted-foreground text-xs">選擇課程</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">無課程</SelectItem>
                              {renderContinuationOption(day, period)}
                              {courses.map(course => (
                                <SelectItem key={course.id} value={course.id}>
                                  {course.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="other">其他...</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {/* 基地選擇 - 只在有課程時顯示，否則保留空間 */}
                          {cell ? (
                            <Select
                              value={getBaseSelectValue(cell)}
                              onValueChange={(value) => handleBaseSelect(day, period, value)}
                            >
                              <SelectTrigger className="w-full min-h-11 sm:h-6 text-xs items-start">
                                <SelectValue placeholder="選擇基地" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">無基地</SelectItem>
                                {bases.map((base) => (
                                  <SelectItem key={base.id} value={base.id}>
                                    {base.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="h-11 sm:h-6"></div>
                          )}
                          
                          {/* 教室選擇 - 只在有課程且有基地時顯示，否則保留空間 */}
                          {renderRoomSelect(day, period, cell)}
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
                {period === 4 && (
                  <>
                    {/* <TableRow className="bg-yellow-50/50">
                      <TableCell className="font-medium text-center text-yellow-700">
                        中午
                      </TableCell>
                      <TableCell className="text-xs text-yellow-600">
                        11:55-13:25
                      </TableCell>
                      {currentWeekdays.map((_, dayIndex) => {
                        const isWeekend = dayIndex >= 5
                        return (
                          <TableCell key={`lunch-${dayIndex}`} className={`text-center text-yellow-600 text-xs font-medium ${
                            isWeekend ? 'bg-slate-50/50' : ''
                          }`}>
                            午間休息
                          </TableCell>
                        )
                      })}
                    </TableRow> */}
                    <TableRow className="bg-blue-50/50">
                      <TableCell className="font-medium text-center text-blue-700">
                        下午
                      </TableCell>
                      <TableCell className="text-xs text-blue-600">
                        基地整理
                      </TableCell>
                      {currentWeekdays.map((_, index) => {
                        const day = index + 1
                        const afternoonBase = getHalfDayBaseDisplay(day, 'afternoon')
                        const afternoonConflict = checkHalfDayBaseConflict(day, 'afternoon')
                        const isWeekend = index >= 5

                        return (
                          <TableCell key={`afternoon-base-${index}`} className={`text-center text-xs font-medium ${
                            isWeekend ? 'bg-stone-300' : ''
                          }`}>
                            <div className={`px-2 py-1 rounded ${
                              afternoonConflict
                                ? 'border border-red-500 text-red-700 bg-red-50'
                                : afternoonBase
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-400'
                            }`}>
                              {afternoonBase || '無'}
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  </>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card-based Day View (visible only on mobile) */}
      <div className="block md:hidden">
        {/* Day Selector */}
        <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-lg p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDay(prev => prev > 1 ? prev - 1 : 7)}
            className="h-11 w-11 p-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="font-semibold text-lg">{WEEKDAYS_WITH_WEEKENDS[selectedDay - 1]}</div>
            <div className="text-sm text-muted-foreground">{weekdayDates[selectedDay - 1]}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDay(prev => prev < 7 ? prev + 1 : 1)}
            className="h-11 w-11 p-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Period Cards */}
        <div className="space-y-3">
          {PERIODS.map(period => {
            const cell = schedule[selectedDay]?.[period]
            const isWeekend = selectedDay >= 6
            
            return (
              <Card
                key={period}
                className={`${
                  isWeekend ? 'bg-gray-50' : ''
                } ${
                  !!cell?.calendarEventId
                    ? 'border-l-4 border-l-green-400'
                    : cell
                      ? 'border-l-4 border-l-yellow-400'
                      : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">第 {period} 節</span>
                      <span className="text-sm text-muted-foreground">
                        {PERIOD_TIMES[period as keyof typeof PERIOD_TIMES]}
                      </span>
                    </div>
                    {!!cell?.calendarEventId && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">已同步</span>
                    )}
                    {cell && !cell.calendarEventId && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">未同步</span>
                    )}
                  </div>
                  
                  {/* Course Selector */}
                  <Select
                    value={getCourseSelectValue(cell)}
                    onValueChange={(value) => handleCourseSelect(selectedDay, period, value)}
                  >
                    <SelectTrigger className={`w-full h-11 text-sm ${
                      !!cell?.calendarEventId
                        ? 'border-green-300 bg-green-50'
                        : cell
                          ? 'border-yellow-300 bg-yellow-50 border-dashed'
                          : 'border-dashed'
                    }`}>
                      <SelectValue>
                        {cell ? getCellContent(selectedDay, period) : (
                          <span className="text-muted-foreground text-sm">選擇課程</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">無課程</SelectItem>
                      {renderMobileContinuationOption(period)}
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">其他...</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Base & Room Selectors */}
                  {cell && (
                    <div className="mt-3 space-y-2">
                      <Select
                        value={getBaseSelectValue(cell)}
                        onValueChange={(value) => handleBaseSelect(selectedDay, period, value)}
                      >
                        <SelectTrigger className="w-full h-11 text-sm">
                          <SelectValue placeholder="選擇基地" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">無基地</SelectItem>
                          {bases.map((base) => (
                            <SelectItem key={base.id} value={base.id}>
                              {base.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* 行動版教室選擇器 */}
                      {cell.base && (() => {
                        const base = bases.find(b => b.name === cell.base)
                        if (!base || base.isSingleRoom || !base.rooms || base.rooms.length === 0) {
                          return null
                        }
                        return (
                          <Select
                            value={cell.room || 'none'}
                            onValueChange={(value) => handleRoomSelect(selectedDay, period, value)}
                          >
                            <SelectTrigger className="w-full h-11 text-sm">
                              <SelectValue placeholder="選擇教室" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">無教室</SelectItem>
                              {base.rooms.map(room => (
                                <SelectItem key={room.id} value={room.name}>
                                  {room.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <AddTempCourseDialog
        open={tempCourseDialog.open}
        onOpenChange={(open) => setTempCourseDialog(prev => ({ ...prev, open }))}
        onAddCourse={handleAddTempCourse}
      />
    </div>
  )
}