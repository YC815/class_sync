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

    const { name, address, isSingleRoom, rooms } = await request.json()
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Verify ownership
    const existingBase = await prisma.base.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingBase) {
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      )
    }

    // Delete existing rooms and create new ones
    await prisma.room.deleteMany({
      where: { baseId: resolvedParams.id }
    })

    const base = await prisma.base.update({
      where: { id: resolvedParams.id },
      data: {
        name,
        address,
        isSingleRoom: isSingleRoom !== undefined ? isSingleRoom : false,
        rooms: (!isSingleRoom && rooms && rooms.length > 0) ? {
          create: rooms.map((roomName: string) => ({
            name: roomName,
            userId: session.user.id
          }))
        } : undefined
      },
      include: {
        rooms: {
          orderBy: {
            name: 'asc'
          }
        }
      }
    })

    // 如果基地名稱或地址有變更，更新相關的 Event 記錄
    if (name !== existingBase.name || address !== existingBase.address) {
      const currentWeek = new Date()
      currentWeek.setHours(0, 0, 0, 0)
      
      // 計算本週的週一
      const dayOfWeek = currentWeek.getDay()
      const monday = new Date(currentWeek)
      monday.setDate(currentWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      
      // 更新當週及未來的 Events（只更新 overrideLocation = false 的事件）
      const updateResult = await prisma.event.updateMany({
        where: {
          baseId: resolvedParams.id,
          userId: session.user.id,
          weekStart: {
            gte: monday
          },
          overrideLocation: false
        },
        data: {
          baseName: name,
          address: address
        }
      })
      
      console.log(`Updated ${updateResult.count} events for base change: "${existingBase.name}" -> "${name}"`)
    }

    return NextResponse.json(base)
  } catch (error) {
    console.error('Error updating base:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
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
    const existingBase = await prisma.base.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingBase) {
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      )
    }

    await prisma.base.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting base:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}