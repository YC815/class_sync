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
}

export default function ScheduleTable({ 
  schedule, 
  courses, 
  onScheduleChange
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
        <div className="flex gap-1 flex-wrap">
          {cell.location && (
            <Badge variant="secondary" className="text-xs">
              {cell.location}
            </Badge>
          )}
          {cell.venue && (
            <Badge variant="outline" className="text-xs">
              {cell.venue}
            </Badge>
          )}
        </div>
      </div>
    )
  }

  const handleCourseSelect = (day: number, period: number, courseId: string) => {
    if (courseId === 'none' || courseId === '') {
      updateCell(day, period, null)
      return
    }

    if (courseId === 'other') {
      // TODO: Open dialog for temporary course
      const courseName = prompt('請輸入臨時課程名稱：')
      if (courseName) {
        updateCell(day, period, {
          courseName,
          isTemporary: true
        })
      }
      return
    }

    const course = courses.find(c => c.id === courseId)
    if (course) {
      updateCell(day, period, {
        courseId: course.id,
        courseName: course.name,
        url: course.defaultUrl
      })
    }
  }

  const handleVenueSelect = (day: number, period: number, venue: string) => {
    const currentCell = schedule[day]?.[period]
    if (!currentCell) return
    
    updateCell(day, period, {
      ...currentCell,
      venue: venue === 'none' ? undefined : venue
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
                  {day}
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
                            <Select
                              value={cell.venue || 'none'}
                              onValueChange={(value) => handleVenueSelect(day, period, value)}
                            >
                              <SelectTrigger className="w-full h-6 text-xs">
                                <SelectValue placeholder="場地" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">無場地</SelectItem>
                                {Object.entries(LOCATIONS).map(([base, rooms]) => 
                                  rooms.map(room => (
                                    <SelectItem key={`${base}-${room}`} value={`${base}${room}`}>
                                      {base}{room}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
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
    </div>
  )
}