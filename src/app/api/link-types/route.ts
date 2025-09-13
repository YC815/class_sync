import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserExists } from '@/lib/user-init'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 確保用戶存在並創建預設鏈結類型
    await ensureUserExists(session.user.id)
    await ensureDefaultLinkTypes(session.user.id)

    const linkTypes = await prisma.linkType.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json(linkTypes)
  } catch (error) {
    console.error('Failed to fetch link types:', error)
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

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // 檢查是否已存在相同名稱
    const existing = await prisma.linkType.findUnique({
      where: {
        userId_name: {
          userId: session.user.id,
          name: name.trim()
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Link type with this name already exists' },
        { status: 409 }
      )
    }

    const linkType = await prisma.linkType.create({
      data: {
        name: name.trim(),
        userId: session.user.id,
        isDefault: false
      }
    })

    return NextResponse.json(linkType, { status: 201 })
  } catch (error) {
    console.error('Failed to create link type:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 確保預設鏈結類型存在
async function ensureDefaultLinkTypes(userId: string) {
  const defaultTypes = ['ONO', 'Classroom']

  for (const typeName of defaultTypes) {
    await prisma.linkType.upsert({
      where: {
        userId_name: {
          userId,
          name: typeName
        }
      },
      update: {},
      create: {
        userId,
        name: typeName,
        isDefault: true
      }
    })
  }
}