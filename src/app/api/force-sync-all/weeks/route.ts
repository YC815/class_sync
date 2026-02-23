import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getWeekStart } from '@/lib/schedule-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const todayWeekStart = getWeekStart(new Date())

    const rows = await prisma.event.findMany({
      where: { userId, weekStart: { gte: todayWeekStart } },
      distinct: ['weekStart'],
      select: { weekStart: true },
      orderBy: { weekStart: 'asc' }
    })

    const weeks = rows.map(r => r.weekStart.toISOString().slice(0, 10))

    console.log(`📋 [ForceSyncWeeks] Found ${weeks.length} weeks to force-sync`)
    return NextResponse.json({ weeks })
  } catch (error) {
    console.error('❌ [ForceSyncWeeks] Error:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}
