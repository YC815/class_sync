import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { initializeUserDefaults } from '@/lib/user-init'

export async function GET() {
  try {
    console.log('🚀 [BasesAPI] GET request received')

    const session = await getServerSession(authOptions)
    console.log(`🔍 [BasesAPI] Session user ID: ${session?.user?.id || 'null'}`)

    if (!session?.user?.id) {
      console.log('❌ [BasesAPI] No session or user ID, returning 401')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log(`👤 [BasesAPI] Processing request for user: ${userId}`)

    // Check current bases count before initialization
    const currentBasesCount = await prisma.base.count({
      where: { userId }
    })
    console.log(`📊 [BasesAPI] User currently has ${currentBasesCount} bases`)

    // 為新用戶初始化預設基地和教室
    console.log('🏗️ [BasesAPI] Calling initializeUserDefaults...')
    const userInfo = {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image
    }
    const initSuccess = await initializeUserDefaults(userId, userInfo)
    console.log(`🔍 [BasesAPI] initializeUserDefaults result: ${initSuccess}`)
    if (!initSuccess) {
      console.error('❌ [BasesAPI] Failed to initialize user defaults, continuing with empty bases')
    }

    // Fetch bases after potential initialization
    console.log('📊 [BasesAPI] Fetching bases from database...')
    const bases = await prisma.base.findMany({
      where: {
        userId: userId
      },
      include: {
        rooms: {
          orderBy: {
            name: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`✅ [BasesAPI] Found ${bases.length} bases for user ${userId}:`)
    bases.forEach((base, index) => {
      console.log(`  ${index + 1}. ${base.name} (${base.rooms.length} rooms)`)
      base.rooms.forEach(room => {
        console.log(`     - ${room.name}`)
      })
    })

    console.log('🎯 [BasesAPI] Returning bases to client')

    // Add debug info for development
    const response = {
      bases,
      debug: {
        userId,
        basesCount: bases.length,
        initSuccess,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ [BasesAPI] Failed to fetch bases:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, address, isSingleRoom, rooms } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const base = await prisma.base.create({
      data: {
        name,
        address,
        isSingleRoom: isSingleRoom || false,
        userId: session.user.id,
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

    return NextResponse.json(base, { status: 201 })
  } catch (error) {
    console.error('Failed to create base:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}