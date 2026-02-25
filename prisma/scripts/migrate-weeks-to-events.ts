/**
 * 資料遷移腳本：將 weeks.data (JSON) 遷移到 events 表
 *
 * ⚠️ 重要：此腳本必須在執行 Prisma migration（移除 weeks.data 欄位）之前運行！
 *
 * 執行順序：
 *   1. 執行此遷移腳本
 *   2. 執行 `npx prisma migrate dev` 或 `npx prisma db push`
 *
 * 執行方式：
 *   npx tsx prisma/scripts/migrate-weeks-to-events.ts
 *
 * 或使用 dry-run 模式（不實際寫入）：
 *   DRY_RUN=true npx tsx prisma/scripts/migrate-weeks-to-events.ts
 */

import { PrismaClient } from '../../src/generated/prisma'
import { writeScheduleAsEvents } from '../../src/lib/schedule-writer'
import type { WeekSchedule } from '../../src/lib/types'

// 由於此腳本在 migration 之前運行，Week model 還有 data 欄位
// 使用 any 繞過型別檢查
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WeekWithData = any

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === 'true'

async function migrate() {
  console.log('='.repeat(60))
  console.log('資料遷移：weeks.data → events 表')
  console.log('='.repeat(60))

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN 模式：不會實際寫入資料庫')
  }

  console.log('')

  try {
    // 找出所有有 weeks.data 但沒有對應 events 的記錄
    console.log('🔍 查詢需要遷移的週課表記錄...')

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const weeksWithData = (await prisma.week.findMany({
      where: {
        data: { not: {} }
      } as any,
      include: {
        events: true
      }
    })) as WeekWithData[]
    /* eslint-enable @typescript-eslint/no-explicit-any */

    console.log(`📊 找到 ${weeksWithData.length} 筆週課表記錄`)

    // 過濾出沒有 events 的記錄
    const weeksToMigrate = weeksWithData.filter(week => week.events.length === 0)
    console.log(`📊 其中 ${weeksToMigrate.length} 筆需要遷移（沒有對應的 events）`)
    console.log('')

    if (weeksToMigrate.length === 0) {
      console.log('✅ 沒有需要遷移的資料')
      return
    }

    // 顯示前 3 筆待遷移的記錄
    console.log('📋 待遷移記錄範例（前 3 筆）：')
    weeksToMigrate.slice(0, 3).forEach((week, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedule = (week as any).data as WeekSchedule
      const cellCount = Object.values(schedule).reduce((sum, day) => {
        return sum + Object.values(day || {}).filter(cell => cell !== null).length
      }, 0)

      console.log(`  ${idx + 1}. Week ${week.id}`)
      console.log(`     - User: ${week.userId}`)
      console.log(`     - Week Start: ${week.weekStart.toISOString().split('T')[0]}`)
      console.log(`     - 課程格數: ${cellCount}`)
    })
    console.log('')

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN 模式結束，不執行實際遷移')
      return
    }

    // 執行遷移
    console.log('🚀 開始遷移...')
    console.log('')

    let successCount = 0
    let errorCount = 0
    const errors: { weekId: string; error: string }[] = []

    for (const week of weeksToMigrate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedule = (week as any).data as WeekSchedule

      try {
        console.log(`  遷移 Week ${week.id} (${week.weekStart.toISOString().split('T')[0]})...`)

        // Migration script uses empty bases array since it's one-time migration
        // from old format without FK constraints
        const result = await writeScheduleAsEvents(
          week.userId,
          week.weekStart,
          schedule,
          prisma,
          []
        )

        console.log(`    ✅ 成功建立 ${result.eventsCreated} 個 events`)
        successCount++
      } catch (error) {
        console.error(`    ❌ 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`)
        errorCount++
        errors.push({
          weekId: week.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('遷移完成')
    console.log('='.repeat(60))
    console.log(`✅ 成功: ${successCount} 筆`)
    console.log(`❌ 失敗: ${errorCount} 筆`)

    if (errors.length > 0) {
      console.log('')
      console.log('失敗記錄：')
      errors.forEach(({ weekId, error }) => {
        console.log(`  - Week ${weekId}: ${error}`)
      })
    }
  } catch (error) {
    console.error('❌ 遷移過程發生錯誤:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
  .then(() => {
    console.log('')
    console.log('✅ 遷移腳本執行完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('')
    console.error('❌ 遷移腳本執行失敗:', error)
    process.exit(1)
  })
