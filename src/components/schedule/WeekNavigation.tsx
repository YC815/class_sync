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
  const goToPreviousWeek = () => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() - 7)
    onWeekChange(newWeek)
  }

  const goToNextWeek = () => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() + 7)
    onWeekChange(newWeek)
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToPreviousWeek}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="text-lg font-semibold min-w-48 text-center">
          {formatDateRange(currentWeek)}
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToNextWeek}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Button 
        variant="outline" 
        size="sm"
        onClick={goToThisWeek}
      >
        本週
      </Button>
    </div>
  )
}