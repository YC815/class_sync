'use client'

import React, { useState } from 'react'
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
import { Link } from 'lucide-react'
import AddTempCourseDialog from './AddTempCourseDialog'
import { 
  WeekSchedule, 
  Course, 
  Base,
  ScheduleCell, 
  WEEKDAYS, 
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

  // Calculate dates for each weekday
  const getWeekdayDates = () => {
    return WEEKDAYS.map((_, index) => {
      const date = new Date(currentWeek)
      date.setDate(currentWeek.getDate() + index)
      return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    })
  }

  const weekdayDates = getWeekdayDates()
  const updateCell = (day: number, period: number, data: ScheduleCell | null) => {
    const newSchedule = { ...schedule }
    newSchedule[day] = { ...newSchedule[day], [period]: data }
    onScheduleChange(newSchedule)
  }

  const getCellContent = (day: number, period: number) => {
    const cell = schedule[day]?.[period]
    if (!cell) return null

    const course = courses.find(c => c.id === cell.courseId)
    const displayName = cell.courseName || course?.name || '未知課程'
    
    return (
      <div className="flex items-center gap-1">
        <span className={`text-xs font-medium ${cell.isContinuation ? 'text-orange-600' : ''}`}>
          {cell.isContinuation ? `連堂（${displayName}）` : displayName}
        </span>
        {(cell.url || course?.links?.length) && (
          <Link className="w-3 h-3 text-blue-500" />
        )}
      </div>
    )
  }

  const handleCourseSelect = (day: number, period: number, courseId: string) => {
    if (courseId === 'none' || courseId === '') {
      updateCell(day, period, null)
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
          isContinuation: true
        })
      }
      return
    }

    const course = courses.find(c => c.id === courseId)
    if (course) {
      updateCell(day, period, {
        courseId: course.id,
        courseName: course.name,
        url: course.links?.[0]?.url,
        base: undefined, // 重設基地選擇
        room: undefined  // 重設教室選擇
      })
    }
  }

  const handleBaseSelect = (day: number, period: number, baseId: string) => {
    const currentCell = schedule[day]?.[period]
    if (!currentCell) return
    
    const base = bases.find(b => b.id === baseId)
    
    updateCell(day, period, {
      ...currentCell,
      base: baseId === 'none' ? undefined : base?.name,
      room: undefined, // 重設教室選擇
      placeId: baseId === 'none' ? undefined : base?.placeId,
      address: baseId === 'none' ? undefined : base?.address
    })
  }

  const handleRoomSelect = (day: number, period: number, room: string) => {
    const currentCell = schedule[day]?.[period]
    if (!currentCell) return
    
    updateCell(day, period, {
      ...currentCell,
      room: room === 'none' ? undefined : room
    })
  }

  const handleAddTempCourse = (courseName: string) => {
    updateCell(tempCourseDialog.day, tempCourseDialog.period, {
      courseName,
      isTemporary: true,
      base: undefined,
      room: undefined
    })
  }

  return (
    <div className="space-y-4">
      {/* Schedule Table */}
      <div className="border rounded-lg overflow-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">節次</TableHead>
              <TableHead className="w-20 text-center text-xs">時間</TableHead>
              {WEEKDAYS.map((day, index) => (
                <TableHead key={index} className="text-center min-w-32 px-2">
                  <div className="flex flex-col">
                    <span>{day}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {weekdayDates[index]}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERIODS.map(period => (
              <React.Fragment key={period}>
                <TableRow>
                  <TableCell className="font-medium text-center align-top">
                    {period}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground align-top">
                    {PERIOD_TIMES[period as keyof typeof PERIOD_TIMES]}
                  </TableCell>
                  {WEEKDAYS.map((_, dayIndex) => {
                    const day = dayIndex + 1
                    const cell = schedule[day]?.[period]
                    
                    return (
                      <TableCell key={`${day}-${period}`} className="p-1 sm:p-2">
                        <div className="space-y-1">
                          <Select
                            value={cell?.isContinuation ? 'continuation' : (cell?.courseId || (cell?.isTemporary ? 'temp' : 'none'))}
                            onValueChange={(value) => handleCourseSelect(day, period, value)}
                          >
                            <SelectTrigger className="w-full h-auto min-h-8 border-dashed text-xs items-start">
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
                          {cell && (
                            <>
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
                              {(() => {
                                if (!cell.base) return null
                                const base = bases.find(b => b.name === cell.base)
                                if (!base || base.isSingleRoom) return null
                                if (!base.rooms || base.rooms.length === 0) return null
                                
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
                            </>
                          )}
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
                {period === 4 && (
                  <TableRow className="bg-yellow-50/50">
                    <TableCell className="font-medium text-center text-yellow-700">
                      中
                    </TableCell>
                    <TableCell className="text-xs text-yellow-600">
                      11:55-13:25
                    </TableCell>
                    {WEEKDAYS.map((_, dayIndex) => (
                      <TableCell key={`lunch-${dayIndex}`} className="text-center text-yellow-600 text-xs font-medium">
                        午間休息
                      </TableCell>
                    ))}
                  </TableRow>
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