'use client'

import { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Link } from 'lucide-react'
import { 
  WeekSchedule, 
  Course, 
  ScheduleCell, 
  WEEKDAYS, 
  PERIODS, 
  PERIOD_TIMES,
  LOCATIONS,
  LocationBase 
} from '@/lib/types'
import { initializeEmptySchedule } from '@/lib/schedule-utils'

interface ScheduleTableProps {
  schedule: WeekSchedule
  courses: Course[]
  onScheduleChange: (schedule: WeekSchedule) => void
  currentLocation?: LocationBase
  onLocationChange: (location: LocationBase | undefined) => void
}

export default function ScheduleTable({ 
  schedule, 
  courses, 
  onScheduleChange,
  currentLocation,
  onLocationChange 
}: ScheduleTableProps) {
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
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">{displayName}</span>
          {(cell.url || course?.defaultUrl) && (
            <Link className="w-3 h-3 text-blue-500" />
          )}
        </div>
        {cell.location && (
          <Badge variant="secondary" className="text-xs">
            {cell.location}
          </Badge>
        )}
      </div>
    )
  }

  const handleCourseSelect = (day: number, period: number, courseId: string) => {
    if (courseId === 'none') {
      updateCell(day, period, null)
      return
    }

    if (courseId === 'other') {
      // TODO: Open dialog for temporary course
      const courseName = prompt('請輸入臨時課程名稱：')
      if (courseName) {
        updateCell(day, period, {
          courseName,
          isTemporary: true,
          location: currentLocation ? `${currentLocation}` : undefined
        })
      }
      return
    }

    const course = courses.find(c => c.id === courseId)
    if (course) {
      updateCell(day, period, {
        courseId: course.id,
        courseName: course.name,
        url: course.defaultUrl,
        location: currentLocation ? `${currentLocation}` : undefined
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Location Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">本次地點：</span>
        <Select 
          value={currentLocation || ''} 
          onValueChange={(value) => onLocationChange(value as LocationBase | undefined)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="選擇地點" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">無</SelectItem>
            <SelectItem value="弘道">弘道</SelectItem>
            <SelectItem value="吉林">吉林</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schedule Table */}
      <div className="border rounded-lg overflow-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">節次</TableHead>
              <TableHead className="w-20 text-center text-xs">時間</TableHead>
              {WEEKDAYS.map((day, index) => (
                <TableHead key={index} className="text-center min-w-32 px-2">
                  {day}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERIODS.map(period => (
              <TableRow key={period}>
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
                      <Select
                        value={cell?.courseId || (cell?.isTemporary ? 'temp' : '')}
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
                          <SelectItem value="">無課程</SelectItem>
                          {courses.map(course => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="other">其他...</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}