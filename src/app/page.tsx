'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ScheduleTable from '@/components/schedule/ScheduleTable'
import ScheduleTableSkeleton from '@/components/schedule/ScheduleTableSkeleton'
import WeekNavigation from '@/components/schedule/WeekNavigation'
import FloatingSyncButton from '@/components/schedule/FloatingSyncButton'
import CourseManager from '@/components/courses/CourseManager'
import CourseManagerSkeleton from '@/components/courses/CourseManagerSkeleton'
import RoomManager from '@/components/rooms/RoomManager'
import RoomManagerSkeleton from '@/components/rooms/RoomManagerSkeleton'
import UserAccountDropdown from '@/components/auth/UserAccountDropdown'
import BaseViewDialog from '@/components/base/BaseViewDialog'
import { WeekSchedule, Course, Base, ScheduleCell } from '@/lib/types'
import { getWeekStart, initializeEmptyScheduleWithWeekends } from '@/lib/schedule-utils'
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
  const [schedule, setSchedule] = useState<WeekSchedule>(initializeEmptyScheduleWithWeekends())
  const [courses, setCourses] = useState<Course[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [isLoadingBases, setIsLoadingBases] = useState(false)
  const [activeTab, setActiveTab] = useState('schedule')
  // 週六日一直顯示，不需要狀態管理
  const [isResetting, setIsResetting] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showSyncErrorToast, setShowSyncErrorToast] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<WeekSchedule | null>(null)
  const [isPreventingReload, setIsPreventingReload] = useState(false)
  const [showMapDialog, setShowMapDialog] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<'4f' | '5f' | null>(null)
  const [showBaseViewDialog, setShowBaseViewDialog] = useState(false)

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
        // Handle both array format (old) and object format (new) responses
        const basesArray = Array.isArray(data) ? data : (data.bases || [])
        setBases(basesArray)
      }
    } catch (error) {
      console.error('Failed to load bases:', error)
      toast.error('載入基地失敗')
    } finally {
      setIsLoadingBases(false)
    }
  }

  const loadWeekScheduleRef = useRef<((week: Date, skipSyncDeleted?: boolean, preserveLocalChanges?: boolean) => Promise<void>) | undefined>(undefined)

  loadWeekScheduleRef.current = async (week: Date, skipSyncDeleted = false, preserveLocalChanges = false) => {
    // 如果有待處理的變更，則跳過載入以保護用戶輸入
    if (preserveLocalChanges && pendingChanges) {
      console.log('⏸️ [LoadSchedule] 跳過載入以保留本地變更')
      return
    }

    // 如果正在防止重載，也跳過載入
    if (isPreventingReload) {
      console.log('⏸️ [LoadSchedule] 正在防止重載，跳過載入')
      return
    }

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
        if (data.schedule && Object.keys(data.schedule).length > 0) {
          // 確保載入的課表包含週末資料結構
          const fullSchedule = initializeEmptyScheduleWithWeekends()
          Object.keys(data.schedule).forEach(day => {
            const dayNum = parseInt(day)
            if (dayNum >= 1 && dayNum <= 7) {
              const daySchedule: { [period: number]: ScheduleCell | null } = {}
              Object.keys(data.schedule[dayNum] || {}).forEach(period => {
                const periodNum = parseInt(period)
                const cell = data.schedule[dayNum][periodNum]
                if (cell) {
                  // 從服務器載入的數據標記為已同步
                  daySchedule[periodNum] = {
                    ...cell,
                    isSynced: true,
                    calendarEventId: cell.calendarEventId
                  }
                }
              })
              fullSchedule[dayNum] = daySchedule
            }
          })

          // 合併邏輯：保留本地未同步項目，服務器已同步項目優先
          const currentSchedule = schedule
          const mergedSchedule = { ...fullSchedule }

          // 遍歷現有課表，保留未同步項目
          Object.keys(currentSchedule).forEach(day => {
            const dayNum = parseInt(day)
            if (dayNum >= 1 && dayNum <= 7) {
              Object.keys(currentSchedule[dayNum] || {}).forEach(period => {
                const periodNum = parseInt(period)
                const currentCell = currentSchedule[dayNum]?.[periodNum]
                const serverCell = fullSchedule[dayNum]?.[periodNum]

                if (currentCell && !currentCell.isSynced && !serverCell) {
                  // 保留未同步的本地項目
                  if (!mergedSchedule[dayNum]) mergedSchedule[dayNum] = {}
                  mergedSchedule[dayNum][periodNum] = currentCell
                }
                // 服務器有同步項目時，優先使用服務器項目（已在上面設置）
              })
            }
          })

          setSchedule(mergedSchedule)

          console.log(`載入 ${weekStartStr} 週課表:`, data.totalEvents || Object.keys(data.schedule).length, '個時段')

          // 顯示恢復結果通知
          if (data.recoveryInfo?.recoveredEvents > 0) {
            toast.success(`已從 Google Calendar 自動恢復 ${data.recoveryInfo.recoveredEvents} 個事件`)
          }
        } else {
          // 只在沒有資料時才設定空課表
          setSchedule(initializeEmptyScheduleWithWeekends())
        }
      } else if (scheduleResponse.status === 404) {
        setSchedule(initializeEmptyScheduleWithWeekends())
      } else {
        console.warn('載入週課表失敗:', scheduleResponse.status)
        setSyncError('載入週課表失敗')
        // 載入失敗時不重設課表，保持現有狀態
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
      // 網路錯誤時不重設課表，避免閃爍
    } finally {
      setIsLoadingSchedule(false)
    }
  }

  const loadWeekSchedule = useCallback(async (week: Date, skipSyncDeleted = false, preserveLocalChanges = false) => {
    return loadWeekScheduleRef.current?.(week, skipSyncDeleted, preserveLocalChanges)
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
          // Reload the schedule to show recovered events, but preserve local changes
          await loadWeekSchedule(week, true, true) // Skip sync-deleted and preserve local changes
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
  }, [currentWeek, session?.user?.id, loadWeekSchedule])

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
                loadWeekSchedule(currentWeek, false, true) // 保留本地變更
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


  const handleSync = async (): Promise<{ syncedEvents: number; deletedEvents: number; message: string }> => {
    if (!currentWeek) {
      console.log('🚫 [Sync] No current week selected')
      throw new Error('No current week selected')
    }

    const weekStartStr = formatDateLocal(currentWeek)
    console.log('🔄 [Sync] Starting sync for week:', weekStartStr)
    console.log('🔄 [Sync] Current schedule data:', schedule)

    setIsLoading(true)
    try {
      // 先保存當前課表資料
      console.log('💾 [Sync] Saving schedule data first')
      await saveScheduleData(weekStartStr, schedule)

      // 獲取預覽變更(內部使用)
      console.log('🔍 [Sync] Getting preview changes internally')
      const previewRequestBody = {
        scheduleData: schedule,
        currentLocation: ''
      }

      const previewResponse = await fetch(`/api/weeks/${weekStartStr}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewRequestBody),
      })

      if (previewResponse.status === 401) {
        toast.error('登入逾期，請重新登入')
        await signOut()
        throw new Error('Unauthorized')
      }

      if (!previewResponse.ok) {
        throw new Error('Failed to get preview changes')
      }

      const previewData = await previewResponse.json()
      const previewChanges = previewData.changes

      console.log('🔄 [Sync] Preview changes:', {
        create: previewChanges.create.length,
        update: previewChanges.update.length,
        delete: previewChanges.delete.length
      })

      // 同步到 Google Calendar
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

      // 同步成功後，將所有項目標記為已同步
      const updatedSchedule = { ...schedule }
      Object.keys(updatedSchedule).forEach(day => {
        const dayNum = parseInt(day)
        if (dayNum >= 1 && dayNum <= 7) {
          Object.keys(updatedSchedule[dayNum] || {}).forEach(period => {
            const periodNum = parseInt(period)
            const cell = updatedSchedule[dayNum]?.[periodNum]
            if (cell) {
              updatedSchedule[dayNum][periodNum] = {
                ...cell,
                isSynced: true
              }
            }
          })
        }
      })
      setSchedule(updatedSchedule)

      // 同步成功後清除待處理變更，避免重新載入
      setPendingChanges(null)
      setIsPreventingReload(false)

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

  const saveScheduleData = async (weekStartStr: string, scheduleData: WeekSchedule): Promise<void> => {
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
        throw new Error(`Save failed: ${response.status}`)
      } else {
        console.log('✅ [SaveSchedule] Schedule data saved successfully')
      }
    } catch (error) {
      console.warn('❌ [SaveSchedule] Save error:', error)
      throw error
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

      // Force page reload to ensure all components refresh with new data
      setTimeout(() => {
        window.location.reload()
      }, 1000) // Give user time to see the success message
      
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
          <Button
            onClick={() => signIn('google')}
            className="gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 登入
          </Button>
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
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="schedule">週課表</TabsTrigger>
                  <TabsTrigger value="courses">課程庫</TabsTrigger>
                  <TabsTrigger value="rooms">教室庫</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              {/* Google Sheets Button */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                asChild
              >
                <a
                  href="https://docs.google.com/spreadsheets/d/1scxvMRoDHDc_ubV6fWd0rOcHpFzwMESrBmOtoHiezPc/edit?gid=0#gid=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  基礎課表
                </a>
              </Button>


              {/* Jilin Base Map Dropdown */}
              <div className="relative group hidden sm:block">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  吉林基地地圖
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>

                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <div className="p-4 space-y-4">
                    <div className="text-sm font-medium text-gray-900 border-b pb-2">吉林基地地圖</div>

                    {/* Floor plans */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">樓層平面圖</h4>
                        <div className="space-y-2">
                          <button
                            className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm"
                            onClick={() => {
                              setSelectedFloor('4f')
                              setShowMapDialog(true)
                            }}
                          >
                            四樓平面圖
                          </button>
                          <button
                            className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm"
                            onClick={() => {
                              setSelectedFloor('5f')
                              setShowMapDialog(true)
                            }}
                          >
                            五樓平面圖
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">重要提醒</h4>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div>• 移動力教室靠近辦公室</div>
                          <div>• 學生圖像教室：移動力＋影響力＋學習力</div>
                          <div>• 創造力坊在五樓電梯旁</div>
                          <div>• 跨域合作坊在四樓辦公室旁</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <UserAccountDropdown
                onTestReset={handleTestReset}
                onRecover={currentWeek ? () => manualRecovery(currentWeek) : undefined}
                isResetting={isResetting}
                isLoading={isLoading}
              />
            </div>
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
                }}
                onScheduleUpdated={(newSchedule) => {
                  setSchedule(newSchedule)
                }}
              />
              
              {isLoadingSchedule ? (
                <ScheduleTableSkeleton />
              ) : (
                <ScheduleTable
                  schedule={schedule}
                  courses={courses}
                  bases={bases}
                  onScheduleChange={(newSchedule) => {
                    setSchedule(newSchedule)
                    // 標記有待處理的變更
                    setPendingChanges(newSchedule)
                    setIsPreventingReload(true)

                    // 自動保存課表變更 (debounced)
                    if (currentWeek) {
                      const weekStartStr = formatDateLocal(currentWeek)
                      setTimeout(() => {
                        saveScheduleData(weekStartStr, newSchedule).then(() => {
                          // 保存完成後清除防止重載標記
                          setPendingChanges(null)
                          setIsPreventingReload(false)
                        }).catch(() => {
                          // 保存失敗時保持標記
                          console.warn('保存失敗，保持本地變更')
                        })
                      }, 1000)
                    }
                  }}
                  currentWeek={currentWeek}
                />
              )}
              
              <FloatingSyncButton
                onSync={handleSync}
                onBaseView={() => setShowBaseViewDialog(true)}
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
            <RoomManager
              bases={bases}
              onBasesChange={setBases}
            />
          )}
        </TabsContent>
        </Tabs>
      </main>

      {/* Map Dialog */}
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="w-[70vw] h-[70vh] p-4">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-center">
              {selectedFloor === '4f' ? '吉林基地-四樓' : selectedFloor === '5f' ? '吉林基地-五樓' : ''}平面圖
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center h-[calc(100%-60px)] overflow-auto">
            {selectedFloor && (
              <img
                src={`/JilinMap/${selectedFloor}.png`}
                alt={`${selectedFloor === '4f' ? '四樓' : '五樓'}平面圖`}
                className="w-full h-full object-contain cursor-zoom-in"
                onClick={(e) => {
                  if (e.currentTarget.style.transform === 'scale(1.5)') {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.cursor = 'zoom-in'
                  } else {
                    e.currentTarget.style.transform = 'scale(1.5)'
                    e.currentTarget.style.cursor = 'zoom-out'
                  }
                }}
                style={{ transition: 'transform 0.2s ease' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Base View Dialog */}
      {currentWeek && (
        <BaseViewDialog
          open={showBaseViewDialog}
          onOpenChange={setShowBaseViewDialog}
          bases={bases}
          schedule={schedule}
          currentWeek={currentWeek}
        />
      )}
    </div>
  )
}
