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
  onScheduleChange: (schedule: WeekSchedule) => void
  currentWeek: Date
}

export default function ScheduleTable({ 
  schedule, 
  courses, 
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
        <span className="text-sm font-medium">{displayName}</span>
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

  const handleBaseSelect = (day: number, period: number, baseValue: string) => {
    const currentCell = schedule[day]?.[period]
    if (!currentCell) return
    
    const baseInfo = BASE_INFO[baseValue]
    
    updateCell(day, period, {
      ...currentCell,
      base: baseValue === 'none' ? undefined : baseValue,
      room: undefined, // 重設教室選擇
      placeId: baseValue === 'none' ? undefined : baseInfo?.placeId,
      address: baseValue === 'none' ? undefined : baseInfo?.address
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
                  <TableCell className="font-medium text-center">
                    {period}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {PERIOD_TIMES[period as keyof typeof PERIOD_TIMES]}
                  </TableCell>
                  {WEEKDAYS.map((_, dayIndex) => {
                    const day = dayIndex + 1
                    const cell = schedule[day]?.[period]
                    
                    return (
                      <TableCell key={`${day}-${period}`} className="p-1 sm:p-2">
                        <div className="space-y-1">
                          <Select
                            value={cell?.courseId || (cell?.isTemporary ? 'temp' : 'none')}
                            onValueChange={(value) => handleCourseSelect(day, period, value)}
                          >
                            <SelectTrigger className="w-full h-auto min-h-8 border-dashed text-xs">
                              <SelectValue>
                                {cell ? getCellContent(day, period) : (
                                  <span className="text-muted-foreground text-xs">選擇課程</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">無課程</SelectItem>
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
                                value={cell.base || 'none'}
                                onValueChange={(value) => handleBaseSelect(day, period, value)}
                              >
                                <SelectTrigger className="w-full h-6 text-xs">
                                  <SelectValue placeholder="選擇基地" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">無基地</SelectItem>
                                  {Object.entries(BASES).map(([baseName, baseValue]) => (
                                    <SelectItem key={baseValue} value={baseValue}>
                                      {baseName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {cell.base && ROOMS_BY_BASE[cell.base as keyof typeof ROOMS_BY_BASE]?.length > 0 && (
                                <Select
                                  value={cell.room || 'none'}
                                  onValueChange={(value) => handleRoomSelect(day, period, value)}
                                >
                                  <SelectTrigger className="w-full h-6 text-xs">
                                    <SelectValue placeholder="選擇教室" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">無教室</SelectItem>
                                    {ROOMS_BY_BASE[cell.base as keyof typeof ROOMS_BY_BASE].map(room => (
                                      <SelectItem key={room} value={room}>
                                        {room}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
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