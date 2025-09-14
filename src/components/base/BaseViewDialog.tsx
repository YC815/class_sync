'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Base, WeekSchedule } from '@/lib/types'

interface BaseViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bases: Base[]
  schedule: WeekSchedule
  currentWeek: Date
}

export default function BaseViewDialog({
  open,
  onOpenChange,
  bases,
  schedule,
  currentWeek
}: BaseViewDialogProps) {
  const [baseSchedule, setBaseSchedule] = useState<{
    [day: number]: {
      morning: { bases: string[]; hasConflict: boolean };
      afternoon: { bases: string[]; hasConflict: boolean }
    }
  }>({})

  useEffect(() => {
    if (!open) return

    // 分析當週課表中的基地使用情況
    const analysis: {
      [day: number]: {
        morning: { bases: string[]; hasConflict: boolean };
        afternoon: { bases: string[]; hasConflict: boolean }
      }
    } = {}

    // 初始化每天的資料結構
    for (let day = 1; day <= 7; day++) {
      analysis[day] = {
        morning: { bases: [], hasConflict: false },
        afternoon: { bases: [], hasConflict: false }
      }
    }

    // 分析課表中的基地使用情況
    Object.entries(schedule).forEach(([dayStr, daySchedule]) => {
      const day = parseInt(dayStr)
      if (day >= 1 && day <= 7 && daySchedule) {
        // 檢查上午和下午的基地衝突（複製週課表邏輯）
        const checkHalfDayConflict = (halfDay: 'morning' | 'afternoon') => {
          const periods = halfDay === 'morning' ? [1, 2, 3, 4] : [5, 6, 7, 8]
          const bases = new Set<string>()

          periods.forEach(period => {
            const cell = daySchedule[period]
            if (cell?.base && cell.base !== '線上' && cell.base !== '空') {
              bases.add(cell.base)
            }
          })

          // 根據基地數量決定顯示內容
          let displayBases: string[] = []
          let hasConflict = false

          if (bases.size === 0) {
            displayBases = []
          } else if (bases.size === 1) {
            displayBases = Array.from(bases)
          } else {
            displayBases = Array.from(bases)
            hasConflict = true
          }

          analysis[day][halfDay] = {
            bases: displayBases,
            hasConflict
          }
        }

        checkHalfDayConflict('morning')
        checkHalfDayConflict('afternoon')
      }
    })

    setBaseSchedule(analysis)
  }, [open, bases, schedule])

  const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

  const getWeekDates = (weekStart: Date) => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates(currentWeek)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            基地使用情況 - {currentWeek.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })} 週
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium w-20">時段</th>
                  {dayNames.map((dayName, index) => (
                    <th key={index} className="text-center p-3 font-medium">
                      <div>{dayName}</div>
                      <div className="text-xs text-gray-500 font-normal">
                        {weekDates[index].getMonth() + 1}/{weekDates[index].getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-medium bg-gray-50">上午</td>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => {
                    const morningData = baseSchedule[day]?.morning
                    const hasConflict = morningData?.hasConflict || false
                    const bases = morningData?.bases || []

                    return (
                      <td key={day} className="p-3 text-center">
                        <div className="space-y-1">
                          {bases.length > 0 ? (
                            hasConflict ? (
                              <div className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs border border-red-300">
                                <div className="font-semibold">基地衝突</div>
                                <div className="text-xs mt-1">
                                  {bases.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                {bases[0]}
                              </div>
                            )
                          ) : (
                            <div className="text-gray-400 text-xs">-</div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="p-3 font-medium bg-gray-50">下午</td>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => {
                    const afternoonData = baseSchedule[day]?.afternoon
                    const hasConflict = afternoonData?.hasConflict || false
                    const bases = afternoonData?.bases || []

                    return (
                      <td key={day} className="p-3 text-center">
                        <div className="space-y-1">
                          {bases.length > 0 ? (
                            hasConflict ? (
                              <div className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs border border-red-300">
                                <div className="font-semibold">基地衝突</div>
                                <div className="text-xs mt-1">
                                  {bases.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                {bases[0]}
                              </div>
                            )
                          ) : (
                            <div className="text-gray-400 text-xs">-</div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {bases.length === 0 && (
            <div className="mt-6 p-8 text-center text-muted-foreground border rounded-lg">
              <div className="space-y-2">
                <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div>目前沒有基地資料</div>
                <div className="text-sm">請到教室庫頁面新增基地</div>
              </div>
            </div>
          )}

          {bases.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">說明</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-blue-100 rounded"></div>
                  <span>上午使用的基地</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-green-100 rounded"></div>
                  <span>下午使用的基地</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-red-100 rounded border border-red-300"></div>
                  <span>基地衝突 - 同一時段使用多個不同基地</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  • 當同一個上午或下午安排在多個不同的實體基地時會顯示衝突警示
                  <br />
                  • 線上課程和空堂不會計入衝突檢測
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}