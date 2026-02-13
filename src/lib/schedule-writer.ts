import { PrismaClient } from '@/generated/prisma'
import { WeekSchedule, ScheduleEvent } from './types'
import { mergeAdjacentPeriods, validateScheduleEvent } from './schedule-utils'

/**
 * 將 WeekSchedule 轉換為 Event 記錄陣列（未合併）
 */
function scheduleToEvents(
  schedule: WeekSchedule,
  userId: string,
  weekStart: Date
): Array<Omit<import('@/generated/prisma').Event, 'id' | 'createdAt' | 'updatedAt'>> {
  const events: Array<Omit<import('@/generated/prisma').Event, 'id' | 'createdAt' | 'updatedAt'>> = []

  Object.entries(schedule).forEach(([dayStr, periods]) => {
    const weekday = parseInt(dayStr)
    if (weekday < 1 || weekday > 7) return

    if (!periods) return

    Object.entries(periods).forEach(([periodStr, cellData]) => {
      const period = parseInt(periodStr)
      if (period < 1 || period > 8) return

      const cell = cellData as import('./types').ScheduleCell | null
      if (!cell || !cell.courseName) return

      // 解析 location：優先使用 base/room，否則從 location 字串解析
      let baseName = cell.base || null
      let roomName = cell.room || null

      if (!baseName && cell.location) {
        const parts = cell.location.split(' - ')
        baseName = parts[0].trim()
        roomName = parts[1]?.trim() || null
      }

      events.push({
        userId,
        weekStart,
        weekday,
        periodStart: period,
        periodEnd: period, // 先拆分，稍後合併
        courseId: cell.courseId || null,
        courseName: cell.courseName,
        baseId: null, // 暫不處理 baseId/roomId 的 lookup
        roomId: null,
        baseName,
        roomName,
        address: cell.address || null,
        overrideTitle: false,
        overrideLocation: false,
        calendarEventId: cell.calendarEventId || null,
        seriesId: null
      })
    })
  })

  return events
}

/**
 * 統一的寫入介面：將 WeekSchedule 寫入 events 表
 *
 * 流程：
 * 1. 轉換 WeekSchedule → Event[]
 * 2. 驗證每個 event
 * 3. 合併相鄰時段（連續相同課程）
 * 4. 事務處理（delete all + create all）
 */
export async function writeScheduleAsEvents(
  userId: string,
  weekStart: Date,
  schedule: WeekSchedule,
  prismaClient: PrismaClient
): Promise<{ eventsCreated: number }> {
  console.log(`[writeScheduleAsEvents] 開始寫入 events，週開始: ${weekStart.toISOString()}`)

  // Step 1: 轉換 + 驗證
  const rawEvents = scheduleToEvents(schedule, userId, weekStart)
  console.log(`[writeScheduleAsEvents] 解析出 ${rawEvents.length} 個原始 events`)

  // 驗證每個 event
  rawEvents.forEach(event => {
    const errors = validateScheduleEvent({
      weekday: event.weekday,
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
      courseName: event.courseName || '',
      courseId: event.courseId || undefined
    })
    if (errors.length > 0) {
      throw new Error(`Invalid event: ${errors.join(', ')}`)
    }
  })

  // Step 2: 合併相鄰時段
  const scheduleEvents: ScheduleEvent[] = rawEvents.map(e => ({
    weekday: e.weekday,
    periodStart: e.periodStart,
    periodEnd: e.periodEnd,
    courseId: e.courseId || undefined,
    courseName: e.courseName || '',
    location:
      e.baseName && e.roomName
        ? `${e.baseName} - ${e.roomName}`
        : e.baseName || ''
  }))

  const merged = mergeAdjacentPeriods(scheduleEvents)
  console.log(`[writeScheduleAsEvents] 合併後剩餘 ${merged.length} 個 events`)

  // Step 3: 事務寫入
  const result = await prismaClient.$transaction(async tx => {
    // 刪除該週的所有事件
    const deleteResult = await tx.event.deleteMany({
      where: { userId, weekStart }
    })
    console.log(`[writeScheduleAsEvents] 刪除了 ${deleteResult.count} 個舊 events`)

    // 確保 Week 記錄存在
    await tx.week.upsert({
      where: {
        userId_weekStart: { userId, weekStart }
      },
      create: {
        userId,
        weekStart,
        data: {} // 暫時保留 data 欄位，稍後會移除
      },
      update: {}
    })

    // 批次建立事件
    if (merged.length > 0) {
      const eventsToCreate = merged.map(mergedEvent => {
        // 找到原始 events 中匹配的第一個 event（用於取得 base/room 等資訊）
        const originalEvent = rawEvents.find(
          e =>
            e.weekday === mergedEvent.weekday &&
            e.periodStart >= mergedEvent.periodStart &&
            e.periodStart <= mergedEvent.periodEnd &&
            e.courseName === mergedEvent.courseName
        )

        return {
          userId,
          weekStart,
          weekday: mergedEvent.weekday,
          periodStart: mergedEvent.periodStart,
          periodEnd: mergedEvent.periodEnd,
          courseId: mergedEvent.courseId || null,
          courseName: mergedEvent.courseName,
          baseId: null, // 暫不處理 baseId/roomId 的 lookup
          roomId: null,
          baseName: originalEvent?.baseName || null,
          roomName: originalEvent?.roomName || null,
          address: originalEvent?.address || null,
          overrideTitle: false,
          overrideLocation: false,
          calendarEventId: null, // 新建事件，尚未同步
          seriesId: mergedEvent.seriesId || null
        }
      })

      await tx.event.createMany({
        data: eventsToCreate
      })

      console.log(`[writeScheduleAsEvents] 成功建立 ${eventsToCreate.length} 個新 events`)
    }

    return { eventsCreated: merged.length }
  })

  console.log(
    `[writeScheduleAsEvents] 完成！週 ${weekStart.toISOString()} 共建立 ${result.eventsCreated} 個 events`
  )
  return result
}
