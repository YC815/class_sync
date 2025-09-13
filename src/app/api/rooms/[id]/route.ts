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

    const { name, baseId } = await request.json()
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Verify ownership
    const existingRoom = await prisma.room.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // If baseId is being changed, verify the new base exists and is owned by the user
    if (baseId && baseId !== existingRoom.baseId) {
      const base = await prisma.base.findFirst({
        where: {
          id: baseId,
          userId: session.user.id
        }
      })

      if (!base) {
        return NextResponse.json(
          { error: 'Base not found' },
          { status: 404 }
        )
      }
    }

    const room = await prisma.room.update({
      where: { id: resolvedParams.id },
      data: {
        name,
        ...(baseId && { baseId })
      },
      include: {
        base: true
      }
    })

    // 如果教室名稱或所屬基地有變更，更新相關的 Event 記錄
    if (name !== existingRoom.name || (baseId && baseId !== existingRoom.baseId)) {
      const currentWeek = new Date()
      currentWeek.setHours(0, 0, 0, 0)
      
      // 計算本週的週一
      const dayOfWeek = currentWeek.getDay()
      const monday = new Date(currentWeek)
      monday.setDate(currentWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      
      // 需要獲取基地資訊以更新 baseName 和 address
      const base = room.base
      
      // 更新當週及未來的 Events（只更新 overrideLocation = false 的事件）
      const updateResult = await prisma.event.updateMany({
        where: {
          roomId: resolvedParams.id,
          userId: session.user.id,
          weekStart: {
            gte: monday
          },
          overrideLocation: false
        },
        data: {
          roomName: name,
          baseName: base.name,
          address: base.address,
          ...(baseId && baseId !== existingRoom.baseId && { baseId })
        }
      })
      
      console.log(`Updated ${updateResult.count} events for room change: "${existingRoom.name}" -> "${name}"`)
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error('Error updating room:', error)
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
    const existingRoom = await prisma.room.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    await prisma.room.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}