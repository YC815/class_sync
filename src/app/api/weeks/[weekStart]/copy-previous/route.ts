import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const currentWeekStart = new Date(resolvedParams.weekStart)
    const previousWeekStart = new Date(currentWeekStart)
    previousWeekStart.setDate(currentWeekStart.getDate() - 7)
    
    // 檢查上週是否有資料
    const previousWeek = await prisma.week.findFirst({
      where: {
        userId: session.user.id,
        weekStart: previousWeekStart
      }
    })

    if (!previousWeek) {
      return NextResponse.json(
        { error: '上週沒有課表資料可複製' },
        { status: 404 }
      )
    }

    // 檢查當週是否已有資料
    const currentWeek = await prisma.week.findFirst({
      where: {
        userId: session.user.id,
        weekStart: currentWeekStart
      }
    })

    if (currentWeek) {
      // 更新現有資料
      await prisma.week.update({
        where: { id: currentWeek.id },
        data: { data: previousWeek.data }
      })
    } else {
      // 創建新資料
      await prisma.week.create({
        data: {
          userId: session.user.id,
          weekStart: currentWeekStart,
          data: previousWeek.data
        }
      })
    }

    // 同時複製 Events（如果有的話）
    const previousEvents = await prisma.event.findMany({
      where: {
        userId: session.user.id,
        weekStart: previousWeekStart
      }
    })

    if (previousEvents.length > 0) {
      // 刪除當週現有的 Events
      await prisma.event.deleteMany({
        where: {
          userId: session.user.id,
          weekStart: currentWeekStart
        }
      })

      // 複製上週的 Events 到當週
      const eventsToCreate = previousEvents.map(event => ({
        userId: event.userId,
        weekStart: currentWeekStart,
        weekday: event.weekday,
        periodStart: event.periodStart,
        periodEnd: event.periodEnd,
        courseId: event.courseId,
        courseName: event.courseName,
        baseId: event.baseId,
        roomId: event.roomId,
        baseName: event.baseName,
        roomName: event.roomName,
        address: event.address,
        overrideTitle: event.overrideTitle,
        overrideLocation: event.overrideLocation,
        seriesId: event.seriesId,
        // 注意：不複製 calendarEventId，因為這是 Google Calendar 的專用 ID
      }))

      await prisma.event.createMany({
        data: eventsToCreate
      })
    }

    return NextResponse.json({ 
      message: '成功複製上週課表',
      schedule: previousWeek.data 
    })

  } catch (error) {
    console.error('Failed to copy previous week:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}