import { PrismaClient } from '@/generated/prisma'
import { WeekSchedule, ScheduleEvent, Base } from './types'
import { mergeAdjacentPeriods, validateScheduleEvent } from './schedule-utils'

/**
 * 建立 base/room 名稱到 ID 的查詢 Map
 */
function createLookupMaps(bases: Base[]) {
  const baseNameToId = new Map<string, string>()
  const roomNameToId = new Map<string, string>() // key: "baseName-roomName"

  for (const base of bases) {
    baseNameToId.set(base.name, base.id)
    if (base.rooms) {
      for (const room of base.rooms) {
        roomNameToId.set(`${base.name}-${room.name}`, room.id)
      }
    }
  }

  return { baseNameToId, roomNameToId }
}

/**
 * 將 WeekSchedule 轉換為 Event 記錄陣列（未合併）
 */
function scheduleToEvents(
  schedule: WeekSchedule,
  userId: string,
  weekStart: Date,
  bases: Base[]
): Array<Omit<import('@/generated/prisma').Event, 'id' | 'createdAt' | 'updatedAt'>> {
  const events: Array<Omit<import('@/generated/prisma').Event, 'id' | 'createdAt' | 'updatedAt'>> = []
  const { baseNameToId, roomNameToId } = createLookupMaps(bases)

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

      // 查詢 baseId 和 roomId
      let baseId: string | null = null
      let roomId: string | null = null

      if (baseName) {
        baseId = baseNameToId.get(baseName) || null
        if (!baseId) {
          // 嚴格校驗：如果 baseName 存在但找不到對應 ID，拋出錯誤
          throw new Error(
            `Invalid base name "${baseName}" for event "${cell.courseName}". ` +
            `Available bases: ${Array.from(baseNameToId.keys()).join(', ')}`
          )
        }

        if (roomName) {
          roomId = roomNameToId.get(`${baseName}-${roomName}`) || null
          if (!roomId) {
            // 嚴格校驗：如果 roomName 存在但找不到對應 ID，拋出錯誤
            throw new Error(
              `Invalid room name "${roomName}" in base "${baseName}" for event "${cell.courseName}". ` +
              `Available rooms: ${Array.from(roomNameToId.keys())
                .filter(k => k.startsWith(`${baseName}-`))
                .map(k => k.replace(`${baseName}-`, ''))
                .join(', ')}`
            )
          }
        }
      }

      events.push({
        userId,
        weekStart,
        weekday,
        periodStart: period,
        periodEnd: period, // 先拆分，稍後合併
        courseId: cell.courseId || null,
        courseName: cell.courseName,
        baseId,
        roomId,
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
  prismaClient: PrismaClient,
  bases: Base[]
): Promise<{ eventsCreated: number }> {
  console.log(`[writeScheduleAsEvents] 開始寫入 events，週開始: ${weekStart.toISOString()}`)

  // Step 1: 轉換 + 驗證
  const rawEvents = scheduleToEvents(schedule, userId, weekStart, bases)
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

  // Step 3: 事務前查詢現有 calendarEventId，避免 delete/create 後遺失同步狀態
  const existingEvents = await prismaClient.event.findMany({
    where: { userId, weekStart },
    select: { weekday: true, periodStart: true, periodEnd: true, courseName: true, calendarEventId: true }
  })
  // 使用「降維拆解」策略：將每個 event 的 period 範圍展開為獨立的 key
  // Key 格式: `${weekday}-${period}-${courseName}`
  // 這樣即使合併範圍改變，只要任意節次匹配就能找到 calendarEventId
  const calendarIdMap = new Map<string, string>()
  existingEvents.forEach(e => {
    if (e.calendarEventId) {
      // 為該 event 涵蓋的每個節次都建立一個 entry
      for (let p = e.periodStart; p <= e.periodEnd; p++) {
        const key = `${e.weekday}-${p}-${e.courseName}`
        // 只保留第一個找到的 calendarEventId（理論上應該只有一個）
        if (!calendarIdMap.has(key)) {
          calendarIdMap.set(key, e.calendarEventId)
        }
      }
    }
  })

  // Step 4: 事務寫入
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
        weekStart
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
          baseId: originalEvent?.baseId || null,
          roomId: originalEvent?.roomId || null,
          baseName: originalEvent?.baseName || null,
          roomName: originalEvent?.roomName || null,
          address: originalEvent?.address || null,
          overrideTitle: false,
          overrideLocation: false,
          // 查找合併範圍內任意一個節次是否有 calendarEventId
          // 只要找到一個就繼承給合併後的 event（取第一個找到的）
          calendarEventId: (() => {
            for (let p = mergedEvent.periodStart; p <= mergedEvent.periodEnd; p++) {
              const id = calendarIdMap.get(`${mergedEvent.weekday}-${p}-${mergedEvent.courseName}`)
              if (id) return id
            }
            return null
          })(),
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
