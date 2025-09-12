'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateRange } from '@/lib/schedule-utils'

interface WeekNavigationProps {
  currentWeek: Date
  onWeekChange: (week: Date) => void
}

export default function WeekNavigation({ 
  currentWeek, 
  onWeekChange 
}: WeekNavigationProps) {
  // Get week indicator (本週/下週)
  const getWeekIndicator = () => {
    const today = new Date()
    const currentWeekStart = new Date(currentWeek)
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay() + 1) // Monday of this week
    thisWeekStart.setHours(0, 0, 0, 0)
    
    const nextWeekStart = new Date(thisWeekStart)
    nextWeekStart.setDate(thisWeekStart.getDate() + 7)
    
    currentWeekStart.setHours(0, 0, 0, 0)
    
    if (currentWeekStart.getTime() === thisWeekStart.getTime()) {
      return '本週'
    } else if (currentWeekStart.getTime() === nextWeekStart.getTime()) {
      return '下週'
    } else {
      return null
    }
  }

  const weekIndicator = getWeekIndicator()
  const goToPreviousWeek = () => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() - 7)
    onWeekChange(newWeek)
  }

  const goToRelativeNextWeek = () => {
    // 相對下週：從當前顯示週計算的下一週
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() + 7)
    onWeekChange(newWeek)
  }

  const goToAbsoluteNextWeek = () => {
    // 絕對下週：從今天計算的下週，不是相對當前顯示週的下一週
    const today = new Date()
    const nextWeekStart = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + 7 // +7 天到下週
    nextWeekStart.setDate(diff)
    nextWeekStart.setHours(0, 0, 0, 0)
    onWeekChange(nextWeekStart)
  }

  const goToThisWeek = () => {
    const today = new Date()
    const thisWeekStart = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    thisWeekStart.setDate(diff)
    thisWeekStart.setHours(0, 0, 0, 0)
    onWeekChange(thisWeekStart)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* 日期區塊置中 */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToPreviousWeek}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="relative min-w-64">
          {weekIndicator && (
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                weekIndicator === '本週' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {weekIndicator}
              </span>
            </div>
          )}
          <div className="text-xl font-semibold text-center">
            {formatDateRange(currentWeek)}
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToRelativeNextWeek}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* 本週和下週按鈕在日期下方 */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToThisWeek}
        >
          本週
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToAbsoluteNextWeek}
        >
          下週
        </Button>
      </div>
    </div>
  )
}