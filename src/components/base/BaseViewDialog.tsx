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

  // 基地顏色配置
  const baseColors = [
    'bg-blue-100 text-blue-800 border-blue-300',     // 藍色
    'bg-green-100 text-green-800 border-green-300',   // 綠色
    'bg-yellow-100 text-yellow-800 border-yellow-300', // 黃色
    'bg-purple-100 text-purple-800 border-purple-300', // 紫色
    'bg-pink-100 text-pink-800 border-pink-300',      // 粉色
    'bg-indigo-100 text-indigo-800 border-indigo-300', // 靛藍色
    'bg-teal-100 text-teal-800 border-teal-300',      // 青色
    'bg-orange-100 text-orange-800 border-orange-300', // 橙色
    'bg-cyan-100 text-cyan-800 border-cyan-300',      // 青藍色
    'bg-lime-100 text-lime-800 border-lime-300',      // 萊姆色
  ]

  // 取得基地顏色的函數
  const getBaseColor = (baseName: string, allBases: string[]) => {
    if (!baseName || baseName === '線上' || baseName === '空') {
      return 'bg-gray-100 text-gray-600 border-gray-300'
    }

    // 找出所有唯一的基地名稱並排序以確保一致性
    const uniqueBases = Array.from(new Set(allBases.filter(base =>
      base && base !== '線上' && base !== '空'
    ))).sort()

    const baseIndex = uniqueBases.indexOf(baseName)
    if (baseIndex === -1) return baseColors[0]

    return baseColors[baseIndex % baseColors.length]
  }

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

  // 收集所有基地名稱用於顏色分配
  const getAllBases = () => {
    const allBases: string[] = []
    Object.values(baseSchedule).forEach(dayData => {
      allBases.push(...dayData.morning.bases)
      allBases.push(...dayData.afternoon.bases)
    })
    return allBases
  }

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
          {/* 動態基地顏色圖例 */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-700">
              <div className="flex items-center gap-3 flex-wrap">
                {/* 顯示當前存在的基地 */}
                {Array.from(new Set(getAllBases().filter(base =>
                  base && base !== '線上' && base !== '空'
                ))).sort().map((baseName) => (
                  <div key={baseName} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded border ${getBaseColor(baseName, getAllBases()).split(' ')[0]}`}></div>
                    <span className="text-xs font-medium">{baseName}</span>
                  </div>
                ))}

                {/* 特殊狀態 */}
                <div className="flex items-center gap-1 border-l pl-3 ml-2">
                  <div className="w-3 h-3 bg-red-100 rounded border border-red-300"></div>
                  <span className="text-xs">衝突</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-100 rounded border border-gray-300"></div>
                  <span className="text-xs">無/線上</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium w-32">時段</th>
                  <th className="text-center p-3 font-medium">上午</th>
                  <th className="text-center p-3 font-medium">下午</th>
                </tr>
                <tr className="border-b bg-gray-100">
                  <th className="text-left p-3 font-medium">日期 星期</th>
                  <th className="text-center p-3 font-medium">基地</th>
                  <th className="text-center p-3 font-medium">基地</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map(day => {
                  const morningData = baseSchedule[day]?.morning
                  const afternoonData = baseSchedule[day]?.afternoon
                  const morningHasConflict = morningData?.hasConflict || false
                  const afternoonHasConflict = afternoonData?.hasConflict || false
                  const morningBases = morningData?.bases || []
                  const afternoonBases = afternoonData?.bases || []
                  const allBases = getAllBases()

                  return (
                    <tr key={day} className="border-b">
                      <td className="p-3 font-medium bg-gray-50">
                        <div className="space-y-1">
                          <div>{weekDates[day - 1].getMonth() + 1}/{weekDates[day - 1].getDate()}</div>
                          <div className="text-sm text-gray-600">{dayNames[day - 1]}</div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          {morningBases.length > 0 ? (
                            morningHasConflict ? (
                              <div className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs border border-red-300">
                                <div className="font-semibold">基地衝突</div>
                                <div className="text-xs mt-1">
                                  {morningBases.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div className={`${getBaseColor(morningBases[0], allBases)} px-2 py-1 rounded text-xs border`}>
                                {morningBases[0]}
                              </div>
                            )
                          ) : (
                            <div className="text-gray-400 text-xs">-</div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          {afternoonBases.length > 0 ? (
                            afternoonHasConflict ? (
                              <div className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs border border-red-300">
                                <div className="font-semibold">基地衝突</div>
                                <div className="text-xs mt-1">
                                  {afternoonBases.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div className={`${getBaseColor(afternoonBases[0], allBases)} px-2 py-1 rounded text-xs border`}>
                                {afternoonBases[0]}
                              </div>
                            )
                          ) : (
                            <div className="text-gray-400 text-xs">-</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

        </div>
      </DialogContent>
    </Dialog>
  )
}