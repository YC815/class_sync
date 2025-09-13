import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { initializeUserDefaults } from '@/lib/user-init'

export async function POST(req: NextRequest) {
  let allEvents: { calendarEventId: string | null }[] = []
  
  try {
    // Get session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('[TestReset] No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log(`🧪 [TestReset] Starting test reset for user: ${userId}`)

    // Step 1: Delete all calendar events for this user
    try {
      console.log('📅 [TestReset] Deleting all calendar events...')
      
      // Get all events from database first
      allEvents = await prisma.event.findMany({
        where: {
          userId,
          calendarEventId: { not: null }
        },
        select: { calendarEventId: true }
      })
      
      console.log(`📅 [TestReset] Found ${allEvents.length} events to delete from calendar`)
      
      // Delete from Google Calendar if we have valid events
      if (allEvents.length > 0) {
        const calendarService = new GoogleCalendarService(session.accessToken!)
        let oauthError = false
        
        for (const event of allEvents) {
          if (event.calendarEventId) {
            try {
              await calendarService.deleteEvent(event.calendarEventId)
              console.log(`✅ [TestReset] Deleted calendar event: ${event.calendarEventId}`)
            } catch (error: any) {
              // Check for OAuth/authentication errors
              if (error.status === 401 || error.code === 401) {
                console.error(`🔑 [TestReset] OAuth token expired during deletion`)
                oauthError = true
                break // Stop trying to delete more events
              }
              // Ignore 410 (already deleted) and 404 (not found) errors
              else if (error.status === 410 || error.status === 404) {
                console.log(`⚠️ [TestReset] Event already deleted: ${event.calendarEventId}`)
              } else {
                console.error(`❌ [TestReset] Failed to delete event: ${event.calendarEventId}`, error)
              }
            }
          }
        }
        
        // If OAuth error occurred, return early with specific error message
        if (oauthError) {
          return NextResponse.json({ 
            error: 'Google Calendar access expired. Please sign out and sign in again to refresh your permissions.',
            code: 'TOKEN_EXPIRED'
          }, { status: 401 })
        }
      }
      
      // Delete all events from database
      const deletedEvents = await prisma.event.deleteMany({
        where: { userId }
      })
      console.log(`🗑️ [TestReset] Deleted ${deletedEvents.count} events from database`)
      
    } catch (error) {
      console.error('❌ [TestReset] Error deleting calendar events:', error)
      // Continue with other cleanup steps even if calendar deletion fails
    }

    // Step 2: Delete all week schedules
    try {
      console.log('🗓️ [TestReset] Deleting all week schedules...')
      const deletedWeeks = await prisma.week.deleteMany({
        where: { userId }
      })
      console.log(`🗑️ [TestReset] Deleted ${deletedWeeks.count} week schedules`)
    } catch (error) {
      console.error('❌ [TestReset] Error deleting week schedules:', error)
    }

    // Step 3: Reset bases to default (delete all and re-initialize)
    try {
      console.log('🏠 [TestReset] Resetting bases to default...')
      console.log(`🔍 [TestReset] Current userId: ${userId}`)

      // Check existing bases before deletion
      const existingBasesBeforeDeletion = await prisma.base.findMany({
        where: { userId },
        include: { rooms: true }
      })
      console.log(`📊 [TestReset] Found ${existingBasesBeforeDeletion.length} existing bases before deletion:`)
      existingBasesBeforeDeletion.forEach(base => {
        console.log(`  - Base: ${base.name} (${base.rooms.length} rooms)`)
      })

      // Delete all bases for this user (including rooms via cascade)
      const deletedBases = await prisma.base.deleteMany({
        where: { userId }
      })
      console.log(`🗑️ [TestReset] Deleted ${deletedBases.count} bases (rooms deleted via cascade)`)

      // Verify deletion
      const basesAfterDeletion = await prisma.base.count({
        where: { userId }
      })
      console.log(`🔍 [TestReset] Bases count after deletion: ${basesAfterDeletion}`)

      // Re-initialize default bases and rooms
      console.log('🏗️ [TestReset] Re-initializing default bases and rooms...')
      const initSuccess = await initializeUserDefaults(userId)
      if (initSuccess) {
        console.log('✅ [TestReset] initializeUserDefaults returned true')

        // Verify re-initialization
        const basesAfterInit = await prisma.base.findMany({
          where: { userId },
          include: { rooms: true }
        })
        console.log(`📊 [TestReset] After re-initialization, found ${basesAfterInit.length} bases:`)
        basesAfterInit.forEach(base => {
          console.log(`  - Base: ${base.name} (${base.rooms.length} rooms)`)
          base.rooms.forEach(room => {
            console.log(`    - Room: ${room.name}`)
          })
        })
      } else {
        console.error('❌ [TestReset] initializeUserDefaults returned false')
      }

    } catch (error) {
      console.error('❌ [TestReset] Error resetting bases:', error)
    }

    // Step 4: Keep courses unchanged
    console.log('📚 [TestReset] Keeping all courses unchanged')

    console.log('✅ [TestReset] Test reset completed successfully')

    return NextResponse.json({
      message: '測試重置完成！已清除所有events和週課表，教室已重置為預設值，課程保持不變。',
      details: {
        deletedEvents: allEvents.length,
        resetBases: true,
        keptCourses: true
      }
    })

  } catch (error) {
    console.error('❌ [TestReset] Critical error during test reset:', error)
    return NextResponse.json(
      { error: '測試重置失敗，請聯絡管理員' },
      { status: 500 }
    )
  }
}