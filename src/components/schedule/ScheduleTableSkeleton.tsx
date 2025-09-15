import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { WEEKDAYS_WITH_WEEKENDS, PERIODS } from '@/lib/types'

export default function ScheduleTableSkeleton() {
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

      <div className="border rounded-lg overflow-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">節次</TableHead>
              <TableHead className="w-20 text-center text-xs">時間</TableHead>
              {WEEKDAYS_WITH_WEEKENDS.map((day, index) => {
                const isWeekend = index >= 5 // 週六日

                return (
                  <TableHead key={index} className={`text-center min-w-32 px-2 align-middle ${
                    isWeekend ? 'bg-slate-50/50' : ''
                  }`}>
                    <div className="flex flex-col items-center">
                      <span>{day}</span>
                      <Skeleton className="h-3 w-8 mx-auto mt-1" />
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
              {WEEKDAYS_WITH_WEEKENDS.map((_, dayIndex) => {
                const isWeekend = dayIndex >= 5

                return (
                  <TableCell key={`morning-base-${dayIndex}`} className={`text-center text-xs font-medium ${
                    isWeekend ? 'bg-slate-50/50' : ''
                  }`}>
                    <div className={`px-2 py-1 rounded ${isWeekend ? 'bg-slate-100' : 'bg-blue-50 text-blue-700'}`}>
                      <Skeleton className="h-3 w-8 mx-auto" />
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
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  {WEEKDAYS_WITH_WEEKENDS.map((_, dayIndex) => {
                    const isWeekend = dayIndex >= 5

                    return (
                      <TableCell key={`${dayIndex + 1}-${period}`} className={`p-1 sm:p-2 h-20 align-top ${
                        isWeekend ? 'bg-slate-50/20' : ''
                      }`}>
                        <div className="space-y-1 h-full flex flex-col justify-start">
                          <Skeleton className="w-full h-8" />
                          <Skeleton className="w-full h-6" />
                          <Skeleton className="w-full h-6" />
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
                {period === 4 && (
                  <TableRow className="bg-blue-50/50">
                    <TableCell className="font-medium text-center text-blue-700">
                      下午
                    </TableCell>
                    <TableCell className="text-xs text-blue-600">
                      基地整理
                    </TableCell>
                    {WEEKDAYS_WITH_WEEKENDS.map((_, dayIndex) => {
                      const isWeekend = dayIndex >= 5

                      return (
                        <TableCell key={`afternoon-base-${dayIndex}`} className={`text-center text-xs font-medium ${
                          isWeekend ? 'bg-slate-50/50' : ''
                        }`}>
                          <div className={`px-2 py-1 rounded ${isWeekend ? 'bg-slate-100' : 'bg-blue-50 text-blue-700'}`}>
                            <Skeleton className="h-3 w-8 mx-auto" />
                          </div>
                        </TableCell>
                      )
                    })}
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