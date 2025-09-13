import { prisma } from '@/lib/prisma'

// 預設基地和教室資料
const DEFAULT_BASES = [
  {
    name: '線上',
    address: null,
    isSingleRoom: true,
    rooms: []
  },
  {
    name: '吉林基地',
    address: '104台北市中山區吉林路110號',
    isSingleRoom: false,
    rooms: [
      '公民素養坊',
      '創造力坊 5F',
      '協作坊 5F',
      '品格坊 5F',
      '學習力教室 4F',
      '影響力教室 4F',
      '批判思考坊 5F',
      '溝通坊 5F',
      '移動力教室 4F',
      '跨域合作坊 4F'
    ]
  },
  {
    name: '弘道基地',
    address: '100台北市中正區公園路21號',
    isSingleRoom: false,
    rooms: [
      '未來教室',
      '自主教室'
    ]
  }
]

/**
 * 檢查用戶是否已經有基地資料
 */
export async function hasUserBases(userId: string): Promise<boolean> {
  const count = await prisma.base.count({
    where: {
      userId: userId
    }
  })
  return count > 0
}

/**
 * 確保用戶存在於資料庫中
 */
export async function ensureUserExists(userId: string): Promise<boolean> {
  try {
    console.log(`Checking if user exists: ${userId}`)
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })
    console.log(`User exists check result for ${userId}:`, !!user)
    return !!user
  } catch (error) {
    console.error(`Failed to check user existence for ${userId}:`, error)
    return false
  }
}

/**
 * 為新用戶初始化預設的基地和教室
 */
export async function initializeUserDefaults(userId: string, userInfo?: { name?: string | null; email?: string | null; image?: string | null }) {
  try {
    console.log(`🔧 [InitUserDefaults] Starting initialization for user: ${userId}`)

    // 先確保用戶存在，如果不存在則嘗試創建
    let userExists = await ensureUserExists(userId)
    console.log(`🔍 [InitUserDefaults] User exists check result: ${userExists}`)

    if (!userExists) {
      console.log(`🔧 [InitUserDefaults] User ${userId} does not exist, attempting to create...`)

      // 嘗試創建用戶
      try {
        await prisma.user.create({
          data: {
            id: userId,
            name: userInfo?.name || 'Unknown User',
            email: userInfo?.email || null,
            image: userInfo?.image || null,
          }
        })
        console.log(`✅ [InitUserDefaults] Successfully created user: ${userId}`)
        userExists = true
      } catch (createError) {
        console.error(`❌ [InitUserDefaults] Failed to create user ${userId}:`, createError)
        return false
      }
    }

    if (!userExists) {
      console.error(`❌ [InitUserDefaults] User ${userId} still does not exist after creation attempt`)
      return false
    }

    // 檢查是否已經初始化過
    const existingBases = await hasUserBases(userId)
    console.log(`🔍 [InitUserDefaults] User already has bases: ${existingBases}`)
    if (existingBases) {
      console.log(`⏭️ [InitUserDefaults] User ${userId} already has bases, skipping initialization`)
      return true
    }

    console.log(`🏗️ [InitUserDefaults] Initializing default bases for user ${userId}`)
    console.log(`📋 [InitUserDefaults] Default bases to create:`)
    DEFAULT_BASES.forEach((base, index) => {
      console.log(`  ${index + 1}. ${base.name} (${base.isSingleRoom ? 'Single Room' : base.rooms.length + ' rooms'})`)
    })

    // 使用事務確保原子操作
    await prisma.$transaction(async (tx) => {
      console.log(`💫 [InitUserDefaults] Starting transaction...`)

      // 為用戶創建預設基地和教室
      for (let i = 0; i < DEFAULT_BASES.length; i++) {
        const baseData = DEFAULT_BASES[i]
        console.log(`📍 [InitUserDefaults] Creating base ${i + 1}: ${baseData.name}`)

        const createdBase = await tx.base.create({
          data: {
            name: baseData.name,
            address: baseData.address,
            isSingleRoom: baseData.isSingleRoom,
            userId: userId,
            rooms: baseData.rooms.length > 0 ? {
              create: baseData.rooms.map(roomName => ({
                name: roomName,
                userId: userId
              }))
            } : undefined
          },
          include: {
            rooms: true
          }
        })

        console.log(`✅ [InitUserDefaults] Created base: ${createdBase.name} with ${createdBase.rooms.length} rooms`)
        createdBase.rooms.forEach(room => {
          console.log(`    - Room: ${room.name}`)
        })
      }

      console.log(`💫 [InitUserDefaults] Transaction completed successfully`)
    })

    console.log(`✅ [InitUserDefaults] Successfully initialized ${DEFAULT_BASES.length} default bases for user ${userId}`)

    // 最終驗證
    const finalBasesCount = await prisma.base.count({ where: { userId } })
    console.log(`🔍 [InitUserDefaults] Final verification - user now has ${finalBasesCount} bases`)

    return true
  } catch (error) {
    console.error(`❌ [InitUserDefaults] Failed to initialize defaults for user ${userId}:`, error)
    return false
  }
}