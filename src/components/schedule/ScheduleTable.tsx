'use client'

import React, { useState, useEffect } from 'react'
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
import AddTempCourseDialog from './AddTempCourseDialog'
import { 
  WeekSchedule, 
  Course, 
  Base,
  ScheduleCell, 
  WEEKDAYS, 
  WEEKDAYS_WITH_WEEKENDS,
  PERIODS, 
  PERIOD_TIMES,
  BASES,
  ROOMS_BY_BASE,
  BASE_INFO
} from '@/lib/types'

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


  // Calculate dates for each weekday (including weekends)
  const getWeekdayDates = () => {
    return WEEKDAYS_WITH_WEEKENDS.map((_, index) => {
      const date = new Date(currentWeek)
      date.setDate(currentWeek.getDate() + index)
      return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    })
  }

  const weekdayDates = getWeekdayDates()
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
          isSynced: false, // 連堂課程也標記為未同步
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
            isSynced: false, // 新選擇的課程標記為未同步
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
          placeId: baseId === 'none' ? undefined : base?.placeId,
          address: baseId === 'none' ? undefined : base?.address,
          isSynced: false, // 基地變更標記為未同步
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
          isSynced: false, // 教室變更標記為未同步
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
      isSynced: false, // 臨時課程標記為未同步
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

      {/* Schedule Table */}
      <div className="border rounded-lg overflow-auto">
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
                        cell?.isSynced
                          ? 'bg-green-50 border-l-4 border-green-400'
                          : cell
                            ? 'bg-yellow-50 border-l-4 border-yellow-400'
                            : ''
                      }`}>
                        <div className="space-y-1 h-full flex flex-col justify-start">
                          <Select
                            value={(() => {
                              if (cell?.isContinuation) return 'continuation'
                              if (cell?.courseId) return cell.courseId
                              if (cell?.isTemporary && cell?.courseName) {
                                return 'temp'
                              }
                              return 'none'
                            })()}
                            onValueChange={(value) => handleCourseSelect(day, period, value)}
                          >
                            <SelectTrigger className={`w-full h-auto min-h-8 text-xs items-start ${
                              cell?.isSynced
                                ? 'border-green-300 bg-green-25'
                                : cell
                                  ? 'border-yellow-300 bg-yellow-25 border-dashed'
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
                              {(() => {
                                // 檢查是否為偶數節次且上一節有課程
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
                              })()}
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
                              value={(() => {
                                if (!cell.base) return 'none'
                                const base = bases.find(b => b.name === cell.base)
                                return base?.id || 'none'
                              })()}
                              onValueChange={(value) => handleBaseSelect(day, period, value)}
                            >
                              <SelectTrigger className="w-full h-6 text-xs items-start">
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
                            <div className="h-6"></div>
                          )}
                          
                          {/* 教室選擇 - 只在有課程且有基地時顯示，否則保留空間 */}
                          {(() => {
                            if (!cell || !cell.base) {
                              // 沒有課程或基地時保留空間但不顯示選擇器
                              return <div className="h-6"></div>
                            }
                            
                            const base = bases.find(b => b.name === cell.base)
                            if (!base || base.isSingleRoom || !base.rooms || base.rooms.length === 0) {
                              // 單一教室基地或沒有教室時保留空間但不顯示選擇器
                              return <div className="h-6"></div>
                            }
                            
                            return (
                              <Select
                                value={cell.room || 'none'}
                                onValueChange={(value) => handleRoomSelect(day, period, value)}
                              >
                                <SelectTrigger className="w-full h-6 text-xs items-start">
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

      <AddTempCourseDialog
        open={tempCourseDialog.open}
        onOpenChange={(open) => setTempCourseDialog(prev => ({ ...prev, open }))}
        onAddCourse={handleAddTempCourse}
      />
    </div>
  )
}