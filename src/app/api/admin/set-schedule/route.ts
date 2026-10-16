import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { PrismaClient } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { validateScheduleData } from '@/lib/schedule-utils'
import { writeScheduleAsEvents } from '@/lib/schedule-writer'
import type { WeekSchedule, ScheduleCell } from '@/lib/types'

/**
 * 確保 Ray 送來的 course/base/room 名稱都存在於 DB 中。
 * 不存在的會被建立，讓下拉選單能正確顯示。
 */
async function ensureScheduleEntities(
  userId: string,
  schedule: WeekSchedule,
  prismaClient: PrismaClient
): Promise<void> {
  const courseNames = new Set<string>()
  const baseRoomMap = new Map<string, Set<string>>() // baseName → Set<roomName>

  for (const dayData of Object.values(schedule)) {
    if (!dayData) continue
    for (const cell of Object.values(dayData)) {
      const c = cell as ScheduleCell | null
      if (!c) continue
      if (c.courseName) courseNames.add(c.courseName)
      if (c.base) {
        if (!baseRoomMap.has(c.base)) baseRoomMap.set(c.base, new Set())
        if (c.room) baseRoomMap.get(c.base)!.add(c.room)
      }
    }
  }

  // Upsert courses
  for (const name of courseNames) {
    const existing = await prismaClient.course.findFirst({ where: { userId, name } })
    if (!existing) {
      await prismaClient.course.create({ data: { userId, name } })
    }
  }

  // Upsert bases and their rooms
  for (const [baseName, roomNames] of baseRoomMap) {
    let base = await prismaClient.base.findFirst({ where: { userId, name: baseName } })
    if (!base) {
      base = await prismaClient.base.create({
        data: { userId, name: baseName, isSingleRoom: roomNames.size === 0 }
      })
    }
    for (const roomName of roomNames) {
      const existingRoom = await prismaClient.room.findFirst({ where: { baseId: base.id, name: roomName } })
      if (!existingRoom) {
        await prismaClient.room.create({ data: { userId, baseId: base.id, name: roomName } })
      }
    }
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { apiKey, userId, weekStart, data } = await request.json()

    // Validate API key
    const expectedKey = process.env.ADMIN_API_KEY
    if (!expectedKey || !apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const a = Buffer.from(apiKey)
    const b = Buffer.from(expectedKey)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!weekStart || typeof weekStart !== 'string') {
      return NextResponse.json({ error: 'weekStart is required (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'data is required' }, { status: 400 })
    }

    // Validate userId exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validate schedule structure
    const errors = validateScheduleData(data as WeekSchedule)
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Invalid schedule data', errors }, { status: 400 })
    }

    // 確保 Ray 送來的 course/base/room 名稱存在於 DB 中（不存在則建立）
    await ensureScheduleEntities(userId, data as WeekSchedule, prisma)

    // 重新查詢（含剛建立的新實體）
    const bases = await prisma.base.findMany({
      where: { userId },
      include: { rooms: true }
    })

    // 使用新的統一寫入邏輯：將 WeekSchedule 寫入 events 表
    const result = await writeScheduleAsEvents(
      userId,
      new Date(weekStart),
      data as WeekSchedule,
      prisma,
      bases
    )

    console.log(`[Admin API] Successfully wrote schedule for week ${weekStart}: ${result.eventsCreated} events created`)

    return NextResponse.json({
      success: true,
      weekStart,
      eventsCreated: result.eventsCreated
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
