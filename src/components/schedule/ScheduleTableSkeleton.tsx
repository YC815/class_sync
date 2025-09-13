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
import { WEEKDAYS, PERIODS } from '@/lib/types'

export default function ScheduleTableSkeleton() {
  return (
    <div className="space-y-4">
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
                    <Skeleton className="h-3 w-8 mx-auto mt-1" />
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
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  {WEEKDAYS.map((_, dayIndex) => (
                    <TableCell key={`${dayIndex + 1}-${period}`} className="p-1 sm:p-2">
                      <div className="space-y-1">
                        <Skeleton className="w-full h-8" />
                      </div>
                    </TableCell>
                  ))}
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