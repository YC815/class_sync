'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import ScheduleTable from '@/components/schedule/ScheduleTable'
import ScheduleTableSkeleton from '@/components/schedule/ScheduleTableSkeleton'
import MobileDayView from '@/components/schedule/MobileDayView'
import WeekNavigation from '@/components/schedule/WeekNavigation'
import FloatingSyncButton from '@/components/schedule/FloatingSyncButton'
import CourseManager from '@/components/courses/CourseManager'
import CourseManagerSkeleton from '@/components/courses/CourseManagerSkeleton'
import RoomManager from '@/components/rooms/RoomManager'
import RoomManagerSkeleton from '@/components/rooms/RoomManagerSkeleton'
import AuthButton from '@/components/auth/AuthButton'
import { WeekSchedule, Course, Base, ScheduleEvent } from '@/lib/types'
import { getWeekStart, initializeEmptySchedule } from '@/lib/schedule-utils'
import { useNavbarHeight } from '@/lib/hooks'
import { toast } from 'sonner'


function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}


export default function Home() {
  const { data: session, status } = useSession()
  const navbarRef = useRef<HTMLElement>(null!)
  useNavbarHeight(navbarRef)
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null)
  const [schedule, setSchedule] = useState<WeekSchedule>(initializeEmptySchedule())
  const [courses, setCourses] = useState<Course[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [previewChanges, setPreviewChanges] = useState<{
    create: ScheduleEvent[]
    update: ScheduleEvent[]
    delete: string[]
  }>()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [isLoadingBases, setIsLoadingBases] = useState(false)
  const [activeTab, setActiveTab] = useState('schedule')
  // 週六日一直顯示，不需要狀態管理
  const [isResetting, setIsResetting] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showSyncErrorToast, setShowSyncErrorToast] = useState(false)

  // Initialize currentWeek on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentWeek(getWeekStart(new Date()))
  }, [])

  // Load courses and bases when user session is available
  useEffect(() => {
    if (session?.user?.id) {
      loadCourses()
      loadBases()
    }
  }, [session])

  const loadCourses = async () => {
    setIsLoadingCourses(true)
    try {
      const response = await fetch('/api/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data)
      }
    } catch (error) {
      console.error('Failed to load courses:', error)
      toast.error('載入課程失敗')
    } finally {
      setIsLoadingCourses(false)
    }
  }

  const loadBases = async () => {
    setIsLoadingBases(true)
    try {
      const response = await fetch('/api/bases')
      if (response.ok) {
        const data = await response.json()
        setBases(data)
      }
    } catch (error) {
      console.error('Failed to load bases:', error)
      toast.error('載入基地失敗')
    } finally {
      setIsLoadingBases(false)
    }
  }

  const loadWeekSchedule = useCallback(async (week: Date, skipSyncDeleted = false) => {
    setIsLoadingSchedule(true)
    setSyncError(null)

    try {
      const weekStartStr = formatDateLocal(week)

      // 並行執行載入課表和同步刪除的事件（如果需要的話）
      const promises = [fetch(`/api/weeks/${weekStartStr}`)]

      if (!skipSyncDeleted) {
        promises.push(
          fetch(`/api/weeks/${weekStartStr}/sync-deleted`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => new Response('{}', { status: 500 })) // 不讓同步刪除失敗影響載入
        )
      }

      const [scheduleResponse, syncDeletedResponse] = await Promise.all(promises)

      // 處理課表載入
      if (scheduleResponse.ok) {
        const data = await scheduleResponse.json()
        if (data.schedule) {
          setSchedule(data.schedule)
          console.log(`載入 ${weekStartStr} 週課表:`, data.totalEvents || Object.keys(data.schedule).length, '個時段')

          // 顯示恢復結果通知
          if (data.recoveryInfo?.recoveredEvents > 0) {
            toast.success(`已從 Google Calendar 自動恢復 ${data.recoveryInfo.recoveredEvents} 個事件`)
          }
        } else {
          setSchedule(initializeEmptySchedule())
        }
      } else if (scheduleResponse.status === 404) {
        setSchedule(initializeEmptySchedule())
      } else {
        console.warn('載入週課表失敗:', scheduleResponse.status)
        setSyncError('載入週課表失敗')
      }

      // 處理同步刪除的結果（背景處理，不影響主要流程）
      if (syncDeletedResponse && syncDeletedResponse.ok) {
        const syncData = await syncDeletedResponse.json()
        if (syncData.deletedFromDb > 0) {
          console.log(`✅ [SyncDeleted] 已清理 ${syncData.deletedFromDb} 個在 Google Calendar 中已刪除的事件`)
        }
      } else if (syncDeletedResponse && syncDeletedResponse.status === 401) {
        const errorData = await syncDeletedResponse.json().catch(() => ({}))
        if (errorData.code === 'TOKEN_EXPIRED') {
          signOut()
        }
      }

    } catch (error) {
      console.error('載入週課表錯誤:', error)
      setSyncError('載入週課表失敗')
      setSchedule(initializeEmptySchedule())
    } finally {
      setIsLoadingSchedule(false)
    }
  }, [])

  // Manual recovery function for Google Calendar events
  const manualRecovery = useCallback(async (week: Date) => {
    setIsLoading(true)
    try {
      const weekStartStr = formatDateLocal(week)
      const response = await fetch(`/api/weeks/${weekStartStr}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.recoveredEvents > 0 || data.linkedEvents > 0) {
          toast.success(data.message)
          // Reload the schedule to show recovered events
          await loadWeekSchedule(week, true) // Skip sync-deleted to avoid conflicts
        } else {
          toast.info(data.message)
        }
      } else if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.code === 'TOKEN_EXPIRED') {
          toast.error('Google Calendar 權限已過期，請重新登入')
          signOut()
        } else {
          toast.error('權限不足，請重新登入')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || '恢復失敗，請重試')
      }
    } catch (error) {
      console.error('Manual recovery failed:', error)
      toast.error('恢復失敗，請檢查網路連線')
    } finally {
      setIsLoading(false)
    }
  }, [loadWeekSchedule])

  // Load existing schedule when week changes
  useEffect(() => {
    if (currentWeek && session?.user?.id) {
      loadWeekSchedule(currentWeek)
    }
  }, [currentWeek, session, loadWeekSchedule])

  // 顯示同步錯誤的持久性 toast
  useEffect(() => {
    if (syncError && !showSyncErrorToast) {
      setShowSyncErrorToast(true)
      toast.error(
        <div className="flex flex-col gap-2">
          <div>偵測到沒有同步，可能有事件未顯示</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!currentWeek) return
                setIsLoading(true)
                loadWeekSchedule(currentWeek, false)
                  .then(() => {
                    toast.success('重新同步完成')
                    setShowSyncErrorToast(false)
                  })
                  .catch((error) => {
                    console.error('手動同步失敗:', error)
                    toast.error('同步失敗，請重試')
                  })
                  .finally(() => {
                    setIsLoading(false)
                  })
              }}
              className="px-3 py-1 bg-white text-red-600 rounded border hover:bg-gray-50"
              disabled={isLoading}
            >
              {isLoading ? '同步中...' : '重新同步'}
            </button>
            <button
              onClick={() => {
                if (!currentWeek) return
                manualRecovery(currentWeek).then(() => {
                  setShowSyncErrorToast(false)
                  setSyncError(null)
                })
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={isLoading}
            >
              恢復事件
            </button>
          </div>
        </div>,
        {
          duration: Infinity, // 不自動消失
          id: 'sync-error-toast'
        }
      )
    }
  }, [syncError, showSyncErrorToast, isLoading, currentWeek, loadWeekSchedule, manualRecovery])

  const handlePreview = async () => {
    if (!currentWeek) {
      console.log('🚫 [Preview] No current week selected')
      return
    }
    
    const weekStartStr = formatDateLocal(currentWeek)
    console.log('🔍 [Preview] Starting preview for week:', weekStartStr)
    console.log('🔍 [Preview] Current schedule data:', schedule)
    
    setIsLoading(true)
    try {
      const requestBody = {
        scheduleData: schedule,
        currentLocation: '' // TODO: Add default location management if needed
      }
      console.log('🔍 [Preview] Sending request with body:', requestBody)
      
      const response = await fetch(`/api/weeks/${weekStartStr}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('🔍 [Preview] Response status:', response.status)

      if (response.status === 401) {
        toast.error('登入逾期，請重新登入')
        await signOut()
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔍 [Preview] Response error:', errorText)
        throw new Error('Preview failed')
      }

      const data = await response.json()
      console.log('🔍 [Preview] Preview response data:', data)
      setPreviewChanges(data.changes)
    } catch (error) {
      console.error('❌ [Preview] Preview failed:', error)
      toast.error('預覽失敗，請檢查登入狀態並重試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async (): Promise<{ syncedEvents: number; deletedEvents: number; message: string }> => {
    if (!previewChanges || !currentWeek) {
      console.log('🚫 [Sync] Missing preview changes or current week')
      throw new Error('Missing preview changes or current week')
    }
    
    const weekStartStr = formatDateLocal(currentWeek)
    console.log('🔄 [Sync] Starting sync for week:', weekStartStr)
    console.log('🔄 [Sync] Preview changes:', {
      create: previewChanges.create.length,
      update: previewChanges.update.length,
      delete: previewChanges.delete.length
    })
    console.log('🔄 [Sync] Events to create/update:', previewChanges.create.concat(previewChanges.update))
    console.log('🔄 [Sync] Events to delete:', previewChanges.delete)
    
    setIsLoading(true)
    try {
      // 先保存當前課表資料
      console.log('💾 [Sync] Saving schedule data first')
      await saveScheduleData(weekStartStr, schedule)
      
      // 然後同步到 Google Calendar
      const syncRequestBody = {
        events: previewChanges.create.concat(previewChanges.update),
        eventsToDelete: previewChanges.delete
      }
      
      console.log('📅 [Sync] Sending sync request to Google Calendar with body:', syncRequestBody)
      
      const response = await fetch(`/api/weeks/${weekStartStr}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncRequestBody),
      })

      console.log('📅 [Sync] Sync response status:', response.status)

      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}))
        console.error('📅 [Sync] Unauthorized:', errorData)
        toast.error('登入逾期，請重新登入')
        await signOut()
        throw new Error(errorData.error || 'Unauthorized')
      }

      if (!response.ok) {
        const errorData = await response.json()
        console.error('📅 [Sync] Sync error response:', errorData)
        throw new Error(errorData.error || 'Sync failed')
      }

      const data = await response.json()
      console.log('✅ [Sync] Sync successful:', data)
      toast.success(data.message || '同步成功！')
      setPreviewChanges(undefined)
      
      return {
        syncedEvents: data.syncedEvents || 0,
        deletedEvents: data.deletedEvents || 0,
        message: data.message || '同步成功！'
      }
    } catch (error) {
      console.error('❌ [Sync] Sync failed:', error)
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      toast.error(`同步失敗：${errorMessage}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const saveScheduleData = async (weekStartStr: string, scheduleData: WeekSchedule) => {
    console.log('💾 [SaveSchedule] Saving schedule data for week:', weekStartStr)
    console.log('💾 [SaveSchedule] Schedule data:', scheduleData)
    
    try {
      const requestBody = {
        userId: session?.user?.id,
        weekStart: weekStartStr,
        data: scheduleData
      }
      
      console.log('💾 [SaveSchedule] Request body:', requestBody)
      
      const response = await fetch('/api/weeks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('💾 [SaveSchedule] Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.warn('💾 [SaveSchedule] Save failed:', response.status, errorText)
      } else {
        console.log('✅ [SaveSchedule] Schedule data saved successfully')
      }
    } catch (error) {
      console.warn('❌ [SaveSchedule] Save error:', error)
    }
  }

  const handleTestReset = async () => {
    setIsResetting(true)
    try {
      console.log('🧪 [TestReset] Starting test reset...')
      
      const response = await fetch('/api/test-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('🧪 [TestReset] Reset failed:', errorData)
        
        if (response.status === 401 && errorData.code === 'TOKEN_EXPIRED') {
          signOut()
          return
        }
        
        throw new Error(errorData.error || '重置失敗')
      }

      const data = await response.json()
      console.log('✅ [TestReset] Reset successful:', data)
      toast.success(data.message || '測試重置完成！')
      
      // Reset local state
      setSchedule(initializeEmptySchedule())
      setPreviewChanges(undefined)
      
      // Reload data
      if (currentWeek) {
        await loadWeekSchedule(currentWeek)
      }
      await loadCourses()
      await loadBases()
      
    } catch (error) {
      console.error('❌ [TestReset] Reset failed:', error)
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      toast.error(`測試重置失敗：${errorMessage}`)
    } finally {
      setIsResetting(false)
    }
  }


  if (status === 'loading' || !currentWeek) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>載入中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">ClassSync</h1>
            <p className="text-muted-foreground mb-2">請先登入 Google 帳號以開始使用</p>
            <p className="text-sm text-blue-600 font-medium">建議使用 T-school 學校帳號登入</p>
          </div>
          <AuthButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-safe">
      <nav ref={navbarRef} data-navbar className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-safe">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4 md:space-x-8">
              <h1 className="text-lg md:text-xl font-bold">ClassSync</h1>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
                <TabsList>
                  <TabsTrigger value="schedule">週課表</TabsTrigger>
                  <TabsTrigger value="courses">課程庫</TabsTrigger>
                  <TabsTrigger value="rooms">教室庫</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              {/* Test Reset Button - Only show in development/testing */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    🧪 測試重置
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確認測試重置</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作將會執行以下動作，請謹慎確認。
                    </AlertDialogDescription>
                    <div className="space-y-2 text-sm">
                      <ul className="list-disc list-inside space-y-1">
                        <li className="text-red-600">刪除所有Google Calendar事件</li>
                        <li className="text-red-600">清除所有週課表資料</li>
                        <li className="text-red-600">重置教室為預設值（吉林、弘道、線上）</li>
                        <li className="text-green-600">保留所有課程資料</li>
                      </ul>
                      <div className="text-red-600 font-semibold mt-4">
                        ⚠️ 此操作無法復原，請謹慎使用！
                      </div>
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleTestReset}
                      disabled={isResetting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isResetting ? '重置中...' : '確認重置'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <AuthButton />
            </div>
          </div>
          
          {/* Mobile navigation */}
          <div className="md:hidden pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="schedule" className="flex-1 text-xs sm:text-sm">週課表</TabsTrigger>
                <TabsTrigger value="courses" className="flex-1 text-xs sm:text-sm">課程庫</TabsTrigger>
                <TabsTrigger value="rooms" className="flex-1 text-xs sm:text-sm">教室庫</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </nav>

      <main 
        className="container mx-auto p-4 sm:p-6 pt-safe" 
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + var(--navbar-height, 160px))' }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

        <TabsContent value="schedule" className="space-y-6">
          {currentWeek && (
            <>
              <WeekNavigation 
                currentWeek={currentWeek}
                onWeekChange={(newWeek) => {
                  setCurrentWeek(newWeek)
                  setPreviewChanges(undefined) // 清除預覽資料
                }}
                onScheduleUpdated={(newSchedule) => {
                  setSchedule(newSchedule)
                  setPreviewChanges(undefined) // 清除預覽資料
                }}
              />
              
              {(isLoadingSchedule || isLoadingCourses || isLoadingBases) ? (
                <>
                  {/* 桌面版載入骨架 */}
                  <div className="hidden md:block">
                    <ScheduleTableSkeleton />
                  </div>
                  {/* 手機版載入骨架 */}
                  <div className="md:hidden">
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                        <p className="text-muted-foreground">載入中...</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 桌面版週課表 */}
                  <div className="hidden md:block">
                    <ScheduleTable
                      schedule={schedule}
                      courses={courses}
                      bases={bases}
                      onScheduleChange={(newSchedule) => {
                        setSchedule(newSchedule)
                        setPreviewChanges(undefined)
                        // 自動保存課表變更 (debounced)
                        if (currentWeek) {
                          const weekStartStr = formatDateLocal(currentWeek)
                          setTimeout(() => saveScheduleData(weekStartStr, newSchedule), 1000)
                        }
                      }}
                      currentWeek={currentWeek}
                    />
                  </div>
                  
                  {/* 手機版單日視圖 */}
                  <MobileDayView
                    schedule={schedule}
                    courses={courses}
                    onScheduleChange={(newSchedule) => {
                      setSchedule(newSchedule)
                      setPreviewChanges(undefined)
                      // 自動保存課表變更 (debounced)
                      if (currentWeek) {
                        const weekStartStr = formatDateLocal(currentWeek)
                        setTimeout(() => saveScheduleData(weekStartStr, newSchedule), 1000)
                      }
                    }}
                    currentWeek={currentWeek}
                  />
                </>
              )}
              
              <FloatingSyncButton
                onPreview={handlePreview}
                onSync={handleSync}
                onRecover={currentWeek ? () => manualRecovery(currentWeek) : undefined}
                previewChanges={previewChanges}
                isLoading={isLoading}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          {isLoadingCourses ? (
            <CourseManagerSkeleton />
          ) : (
            <CourseManager 
              courses={courses}
              onCoursesChange={setCourses}
            />
          )}
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          {isLoadingBases ? (
            <RoomManagerSkeleton />
          ) : (
            <RoomManager />
          )}
        </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
