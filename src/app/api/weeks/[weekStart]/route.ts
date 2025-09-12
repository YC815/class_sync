import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { WeekSchedule } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const resolvedParams = await params
    const weekStartStr = resolvedParams.weekStart
    
    console.log('API called with weekStart:', weekStartStr)

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('No session found')
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const weekStart = new Date(weekStartStr)
    const userId = session.user.id

    console.log('Fetching schedule for:', { userId, weekStart: weekStart.toISOString() })

    let schedule: WeekSchedule = {
      1: {}, 2: {}, 3: {}, 4: {}, 5: {}
    }

    let totalEvents = 0

    try {
      // 首先嘗試從 Week 表獲取原始課表資料
      const weekRecord = await prisma.week.findUnique({
        where: {
          userId_weekStart: {
            userId,
            weekStart
          }
        }
      })

      if (weekRecord && weekRecord.data) {
        // 如果有保存的課表資料，直接使用
        schedule = weekRecord.data as WeekSchedule
        console.log('Found week record with data')
      } else {
        console.log('No week record found, trying events...')
        // 否則從事件重建課表
        const events = await prisma.event.findMany({
          where: {
            userId,
            weekStart
          },
          orderBy: [
            { weekday: 'asc' },
            { periodStart: 'asc' }
          ]
        })

        console.log('Found events:', events.length)
        totalEvents = events.length

        events.forEach(event => {
          // 為每個時段填入課程資訊
          for (let period = event.periodStart; period <= event.periodEnd; period++) {
            if (!schedule[event.weekday]) {
              schedule[event.weekday] = {}
            }
            
            schedule[event.weekday][period] = {
              courseId: event.courseId || undefined,
              courseName: event.courseName || ''
            }
          }
        })
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      // 如果資料庫查詢失敗，返回空課表而不是錯誤
    }

    return NextResponse.json({ 
      schedule,
      weekStart: weekStart.toISOString().split('T')[0],
      totalEvents
    })
  } catch (error) {
    console.error('Error fetching week schedule:', error)
    return NextResponse.json({ 
      error: '獲取課表失敗', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}