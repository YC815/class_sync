'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import Link from 'next/link'
import useSWR from 'swr'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import UsageDialog from '@/components/help/UsageDialog'
import { Course, Base } from '@/lib/types'
import { useNavbarHeight } from '@/lib/hooks'
import { fetcher } from '@/lib/fetcher'
import { saveLocalSchedule } from '@/lib/local-schedule'
import { toast } from 'sonner'
import { HelpCircle, Loader2, Check, AlertCircle, Download } from 'lucide-react'
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler'
import { AuthErrorModal } from '@/components/auth/AuthErrorModal'

// Custom Hooks
import { useScheduleState } from './hooks/useScheduleState'
import { useSyncOperations } from './hooks/useSyncOperations'
import { useRayIntegration } from './hooks/useRayIntegration'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const { authError, isModalOpen, handleAuthError, closeModal } = useAuthErrorHandler()
  const navbarRef = useRef<HTMLElement>(null!)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useNavbarHeight(navbarRef)

  // Custom Hooks
  const scheduleState = useScheduleState()
  const syncOps = useSyncOperations({
    currentWeek: scheduleState.currentWeek,
    loadWeekSchedule: scheduleState.loadWeekSchedule,
  })
  // SWR Data Fetching
  const { data: courses = [], isLoading: isLoadingCourses, mutate: mutateCourses } = useSWR<Course[]>(
    session?.user?.id ? '/api/courses' : null,
    fetcher
  )
  const { data: bases = [], isLoading: isLoadingBases, mutate: mutateBases } = useSWR<Base[]>(
    session?.user?.id ? '/api/bases' : null,
    fetcher
  )

  const rayIntegration = useRayIntegration({
    onSuccess: async () => {
      console.log('🔵 [RaySync] onSuccess fired — BEFORE mutate')
      console.log('  currentWeek:', scheduleState.currentWeek?.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }))
      console.log('  schedule (current):', JSON.parse(JSON.stringify(scheduleState.schedule)))
      console.log('  bases (stale):', JSON.parse(JSON.stringify(bases)))
      console.log('  courses (stale):', JSON.parse(JSON.stringify(courses)))

      const [newBases, newCourses] = await Promise.all([
        mutateBases(),
        mutateCourses(),
        scheduleState.currentWeek
          ? scheduleState.loadWeekSchedule(scheduleState.currentWeek, false, false)
          : Promise.resolve()
      ])

      console.log('🟢 [RaySync] AFTER mutate')
      console.log('  bases (refreshed):', JSON.parse(JSON.stringify(newBases ?? [])))
      console.log('  courses (refreshed):', JSON.parse(JSON.stringify(newCourses ?? [])))
      // note: scheduleState.schedule here is stale (React state hasn't re-rendered yet)
    }
  })

  // Local UI State (not business logic)
  const [activeTab, setActiveTab] = useState('schedule')
  const [isResetting, setIsResetting] = useState(false)
  const [showSyncErrorToast, setShowSyncErrorToast] = useState(false)
  const [showMapDialog, setShowMapDialog] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<'4f' | '5f' | null>(null)
  const [showBaseViewDialog, setShowBaseViewDialog] = useState(false)
  const [showUsageDialog, setShowUsageDialog] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showForceSyncModal, setShowForceSyncModal] = useState(false)

  // Load schedule when week changes (or on initial mount)
  useEffect(() => {
    if (scheduleState.currentWeek && session?.user?.id) {
      scheduleState.loadWeekSchedule(scheduleState.currentWeek)
    }
  }, [scheduleState.currentWeek, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMobileMenu) {
        const target = event.target as Element
        if (!target.closest('.mobile-menu-container')) {
          setShowMobileMenu(false)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMobileMenu])

  // 檢測 session 中的認證錯誤
  useEffect(() => {
    if (session?.error) {
      console.log('🔴 [Auth] Session error detected:', session.error)
      handleAuthError({
        response: {
          status: 401,
          data: {
            error: 'reauth_required',
            message: '認證 token 已失效，請重新登入以繼續使用。'
          }
        }
      })
    }
  }, [session?.error, handleAuthError])

  // 顯示同步錯誤的持久性 toast
  useEffect(() => {
    if (syncOps.syncError && !showSyncErrorToast) {
      setShowSyncErrorToast(true)
      toast.error(
        <div className="flex flex-col gap-2">
          <div>偵測到沒有同步，可能有事件未顯示</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!scheduleState.currentWeek) return
                scheduleState.loadWeekSchedule(scheduleState.currentWeek, false, true)
                  .then(() => {
                    toast.success('重新同步完成')
                    setShowSyncErrorToast(false)
                  })
                  .catch((error) => {
                    console.error('手動同步失敗:', error)
                    toast.error('同步失敗，請重試')
                  })
              }}
              className="px-3 py-1 bg-white text-red-600 rounded border hover:bg-gray-50"
              disabled={syncOps.isSyncing}
            >
              {syncOps.isSyncing ? '同步中...' : '重新同步'}
            </button>
            <button
              onClick={() => {
                if (!scheduleState.currentWeek) return
                syncOps.handleManualRecovery().then(() => {
                  setShowSyncErrorToast(false)
                })
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={syncOps.isSyncing}
            >
              恢復事件
            </button>
          </div>
        </div>,
        {
          duration: Infinity,
          id: 'sync-error-toast'
        }
      )
    }
  }, [syncOps.syncError, showSyncErrorToast, syncOps.isSyncing, scheduleState.currentWeek, scheduleState.loadWeekSchedule, syncOps.handleManualRecovery])

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

      await Promise.all([mutateCourses(), mutateBases()])
      if (scheduleState.currentWeek) {
        await scheduleState.loadWeekSchedule(scheduleState.currentWeek, true)
      }

    } catch (error) {
      console.error('❌ [TestReset] Reset failed:', error)
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      toast.error(`測試重置失敗：${errorMessage}`)
    } finally {
      setIsResetting(false)
    }
  }

  if (status === 'loading' || !scheduleState.currentWeek) {
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
            <p className="text-xs text-red-500 mt-1">目前網頁驗證還沒通過，如果遇到不安全網頁，請點擊進階 → 前往「ClassSync」(不安全)</p>
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
          <div className="text-center mt-4">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              隱私權政策
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-safe">
      <nav ref={navbarRef} data-navbar className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-safe">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-3 md:space-x-8">
              <div className="flex items-center">
                <img src="/favicon.ico" alt="ClassSync" className="w-8 h-8 rounded-lg" />
                <h1 className="text-lg md:text-xl font-bold ml-2 hidden sm:block">ClassSync</h1>
              </div>

              <div className="flex">
                <div className="sm:hidden">
                  <div className="inline-flex bg-muted p-0.5 rounded-md">
                    <button
                      onClick={() => setActiveTab('schedule')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                        activeTab === 'schedule'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                    >
                      課表
                    </button>
                    <button
                      onClick={() => setActiveTab('courses')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                        activeTab === 'courses'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                    >
                      課程
                    </button>
                    <button
                      onClick={() => setActiveTab('rooms')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                        activeTab === 'rooms'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                    >
                      教室
                    </button>
                  </div>
                </div>

                <div className="hidden sm:block">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="schedule">週課表</TabsTrigger>
                      <TabsTrigger value="courses">課程庫</TabsTrigger>
                      <TabsTrigger value="rooms">教室庫</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
              <div className="relative sm:hidden mobile-menu-container">
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>

                {showMobileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-10">
                    <div className="py-2">
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          setShowUsageDialog(true)
                          setShowMobileMenu(false)
                        }}
                      >
                        <HelpCircle className="w-4 h-4" />
                        使用說明
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={async () => {
                          setShowMobileMenu(false)
                          await rayIntegration.handleRayFetch()
                        }}
                        disabled={rayIntegration.isRayDialogOpen && rayIntegration.rayStep === 'fetching'}
                      >
                        {rayIntegration.isRayDialogOpen && rayIntegration.rayStep === 'fetching' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        抓取課表
                      </button>

                      <a
                        href="https://docs.google.com/spreadsheets/d/1scxvMRoDHDc_ubV6fWd0rOcHpFzwMESrBmOtoHiezPc/edit?gid=0#gid=0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        基礎課表
                      </a>

                      <div className="border-t my-1"></div>

                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          setSelectedFloor('4f')
                          setShowMapDialog(true)
                          setShowMobileMenu(false)
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        四樓平面圖
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          setSelectedFloor('5f')
                          setShowMapDialog(true)
                          setShowMobileMenu(false)
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        五樓平面圖
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 hidden sm:flex"
                onClick={() => setShowUsageDialog(true)}
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden md:inline">使用說明</span>
              </Button>

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
                  <span className="hidden md:inline">基礎課表</span>
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex gap-2"
                onClick={() => rayIntegration.handleRayFetch()}
                disabled={rayIntegration.isRayDialogOpen && rayIntegration.rayStep === 'fetching'}
              >
                {rayIntegration.isRayDialogOpen && rayIntegration.rayStep === 'fetching' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden md:inline">抓取課表</span>
              </Button>

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
                  <span className="hidden md:inline">吉林基地地圖</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>

                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <div className="p-4 space-y-4">
                    <div className="text-sm font-medium text-gray-900 border-b pb-2">吉林基地地圖</div>

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
                onRecover={scheduleState.currentWeek ? () => syncOps.handleManualRecovery() : undefined}
                onForceSync={async () => {
                  setShowForceSyncModal(true)
                  await syncOps.handleForceSync()
                }}
                isResetting={isResetting}
                isLoading={syncOps.isSyncing}
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
          {scheduleState.currentWeek && (
            <>
              <WeekNavigation
                currentWeek={scheduleState.currentWeek}
                onWeekChange={(newWeek) => {
                  scheduleState.setWeek(newWeek)
                }}
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold">💡</span>
                    <span className="text-blue-700">
                      <strong>單次課程地點異動：</strong>建議填寫「無地點」，手動到 Google Calendar 編輯地點
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold">💡</span>
                    <span className="text-blue-700">
                      <strong>單次課程（如講座、測驗）：</strong>建議善用「其他」功能，手動打出課程名稱
                    </span>
                  </div>
                </div>
              </div>

              {scheduleState.isLoadingSchedule ? (
                <ScheduleTableSkeleton />
              ) : (
                <ScheduleTable
                  schedule={scheduleState.schedule}
                  courses={courses}
                  bases={bases}
                  onScheduleChange={(newSchedule) => {
                    scheduleState.setSchedule(newSchedule)
                    scheduleState.markPendingChanges(newSchedule)

                    if (scheduleState.currentWeek) {
                      const weekStartStr = scheduleState.currentWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

                      // 立即寫入 localStorage（write-through，防止 refresh 丟失編輯）
                      saveLocalSchedule(weekStartStr, newSchedule)

                      // 修正 debounce：取消前一個 timer 再設新的
                      if (debounceTimerRef.current) {
                        clearTimeout(debounceTimerRef.current)
                      }
                      debounceTimerRef.current = setTimeout(() => {
                        debounceTimerRef.current = null
                        scheduleState.saveScheduleData(weekStartStr, newSchedule)
                          .then(() => scheduleState.clearPendingChanges())
                          .catch(() => console.warn('保存失敗，保持本地變更'))
                      }, 1000)
                    }
                  }}
                  currentWeek={scheduleState.currentWeek}
                />
              )}

              <FloatingSyncButton
                onSync={() => {
                  if (scheduleState.currentWeek) {
                    const weekStartStr = scheduleState.currentWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
                    return syncOps.handleSync(weekStartStr, scheduleState.schedule)
                  }
                  return Promise.reject(new Error('No current week'))
                }}
                onBaseView={() => setShowBaseViewDialog(true)}
                isLoading={syncOps.isSyncing}
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
              onCoursesChange={(newCourses) => mutateCourses(newCourses, false)}
            />
          )}
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          {isLoadingBases ? (
            <RoomManagerSkeleton />
          ) : (
            <RoomManager
              bases={bases}
              onBasesChange={(newBases) => mutateBases(newBases, false)}
            />
          )}
        </TabsContent>
        </Tabs>
      </main>

      <UsageDialog open={showUsageDialog} onOpenChange={setShowUsageDialog} />

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

      {scheduleState.currentWeek && (
        <BaseViewDialog
          open={showBaseViewDialog}
          onOpenChange={setShowBaseViewDialog}
          bases={bases}
          schedule={scheduleState.schedule}
          currentWeek={scheduleState.currentWeek}
        />
      )}

      <Dialog open={showForceSyncModal} onOpenChange={setShowForceSyncModal}>
        <DialogContent
          className="max-w-md"
          showCloseButton={syncOps.forceSyncStep !== 'syncing'}
          onInteractOutside={(e) => { if (syncOps.forceSyncStep === 'syncing') e.preventDefault() }}
          onEscapeKeyDown={(e) => { if (syncOps.forceSyncStep === 'syncing') e.preventDefault() }}
        >
          {syncOps.forceSyncStep === 'syncing' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                  正在強制重新同步...
                </DialogTitle>
                <DialogDescription>
                  {syncOps.forceSyncProgress
                    ? `正在處理第 ${syncOps.forceSyncProgress.current} / ${syncOps.forceSyncProgress.total} 週`
                    : '正在讀取週清單...'}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
                {syncOps.forceSyncProgress && (
                  <>
                    <div className="text-sm text-orange-800 text-center font-medium">
                      {syncOps.forceSyncProgress.weekStart}
                    </div>
                    <div className="w-full bg-orange-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(syncOps.forceSyncProgress.current / syncOps.forceSyncProgress.total) * 100}%` }}
                      />
                    </div>
                  </>
                )}
                <div className="text-sm text-orange-700 text-center">請稍候，不要關閉此視窗</div>
              </div>
            </>
          )}

          {syncOps.forceSyncStep === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  強制同步完成！
                </DialogTitle>
                <DialogDescription>所有 Google Calendar 事件已重新建立</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <div className="text-green-900">{syncOps.forceSyncMessage}</div>
              </div>
              <button
                onClick={() => { setShowForceSyncModal(false); syncOps.resetForceSyncState() }}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                關閉
              </button>
            </>
          )}

          {syncOps.forceSyncStep === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  強制同步失敗
                </DialogTitle>
                <DialogDescription>請檢查網路或 Google 權限後重試</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-sm text-red-700">{syncOps.forceSyncMessage || '未知錯誤'}</div>
              </div>
              <button
                onClick={() => { setShowForceSyncModal(false); syncOps.resetForceSyncState() }}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                關閉
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rayIntegration.isRayDialogOpen} onOpenChange={rayIntegration.setRayDialogOpen}>
        <DialogContent
          className="max-w-md"
          showCloseButton={rayIntegration.rayStep !== 'fetching'}
          onInteractOutside={(e) => { if (rayIntegration.rayStep === 'fetching') e.preventDefault() }}
          onEscapeKeyDown={(e) => { if (rayIntegration.rayStep === 'fetching') e.preventDefault() }}
        >
          {rayIntegration.rayStep === 'fetching' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  正在抓取課表...
                </DialogTitle>
                <DialogDescription>正在從 RAY 系統同步課表資料</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm text-blue-700 text-center">請稍候，不要關閉此視窗</div>
              </div>
            </>
          )}

          {rayIntegration.rayStep === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  抓取課表完成！
                </DialogTitle>
                <DialogDescription>課表資料已成功從 RAY 系統同步</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <div className="text-green-900">{rayIntegration.rayMessage}</div>
              </div>
              <button
                onClick={() => { rayIntegration.setRayDialogOpen(false); rayIntegration.resetRayState() }}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                關閉
              </button>
            </>
          )}

          {rayIntegration.rayStep === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  抓取課表失敗
                </DialogTitle>
                <DialogDescription>請查看以下錯誤說明</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-sm text-red-700">{rayIntegration.rayMessage || '未知錯誤'}</div>
              </div>
              <button
                onClick={() => { rayIntegration.setRayDialogOpen(false); rayIntegration.resetRayState() }}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                關閉
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {authError && (
        <AuthErrorModal
          isOpen={isModalOpen}
          onClose={closeModal}
          error={authError}
        />
      )}
    </div>
  )
}
