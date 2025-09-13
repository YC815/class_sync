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

    const courses = await prisma.course.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        links: {
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(courses)
  } catch (error) {
    console.error('Failed to fetch courses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('POST /api/courses - Session:', { 
      userId: session?.user?.id, 
      userEmail: session?.user?.email,
      hasSession: !!session 
    })
    
    if (!session?.user?.id) {
      console.log('POST /api/courses - No user ID in session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 確保用戶存在，如果不存在則嘗試創建
    console.log('POST /api/courses - Checking user exists:', session.user.id)
    let userExists = await ensureUserExists(session.user.id)
    
    if (!userExists && session.user.email) {
      // 嘗試創建用戶
      try {
        await prisma.user.create({
          data: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }
        })
        console.log('POST /api/courses - Created user:', session.user.id)
        userExists = true
      } catch (createError) {
        console.error('POST /api/courses - Failed to create user:', createError)
      }
    }
    
    if (!userExists) {
      console.log('POST /api/courses - User not found and could not be created')
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    const body = await request.json()
    console.log('POST /api/courses - Request body:', body)
    
    const { name, links } = body

    if (!name) {
      console.log('POST /api/courses - Missing name field')
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    console.log('POST /api/courses - Creating course:', { name, linksCount: links?.length || 0 })

    const course = await prisma.course.create({
      data: {
        name,
        userId: session.user.id,
        links: links && links.length > 0 ? {
          create: links.map((link: { name: string; url: string }, index: number) => ({
            name: link.name,
            url: link.url,
            order: index
          }))
        } : undefined
      },
      include: {
        links: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    console.log('POST /api/courses - Course created successfully:', course.id)
    return NextResponse.json(course, { status: 201 })
  } catch (error) {
    console.error('POST /api/courses - Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      meta: (error as any)?.meta
    })
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}