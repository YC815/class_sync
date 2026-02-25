import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Verify ownership
    const existingCourse = await prisma.course.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingCourse) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      )
    }

    const course = await prisma.course.update({
      where: { id: resolvedParams.id },
      data: { name }
    })

    // 如果課程名稱有變更，更新相關的 Event 記錄
    if (name !== existingCourse.name) {
      const currentWeek = new Date()
      currentWeek.setHours(0, 0, 0, 0)
      
      // 計算本週的週一
      const dayOfWeek = currentWeek.getDay()
      const monday = new Date(currentWeek)
      monday.setDate(currentWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      
      // 更新當週及未來的 Events（只更新 overrideTitle = false 的事件）
      const updateResult = await prisma.event.updateMany({
        where: {
          courseId: resolvedParams.id,
          userId: session.user.id,
          weekStart: {
            gte: monday
          },
          overrideTitle: false
        },
        data: {
          courseName: name
        }
      })
      
      console.log(`Updated ${updateResult.count} events for course name change: "${existingCourse.name}" -> "${name}"`)
    }

    return NextResponse.json(course)
  } catch (error) {
    console.error('Error updating course:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Verify ownership
    const existingCourse = await prisma.course.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingCourse) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      )
    }

    await prisma.course.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting course:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}