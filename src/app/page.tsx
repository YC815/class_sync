'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ScheduleTable from '@/components/schedule/ScheduleTable'
import MobileDayView from '@/components/schedule/MobileDayView'
import WeekNavigation from '@/components/schedule/WeekNavigation'
import ScheduleActions from '@/components/schedule/ScheduleActions'
import CourseManager from '@/components/courses/CourseManager'
import RoomManager from '@/components/rooms/RoomManager'
import AuthButton from '@/components/auth/AuthButton'
import { WeekSchedule, Course, Base, ScheduleEvent } from '@/lib/types'
import { getWeekStart, initializeEmptySchedule } from '@/lib/schedule-utils'
import { toast } from 'sonner'


export default function Home() {
  const { data: session, status } = useSession()
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
  const [activeTab, setActiveTab] = useState('schedule')

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
    try {
      const response = await fetch('/api/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data)
      }
    } catch (error) {
      console.error('Failed to load courses:', error)
      toast.error('載入課程失敗')
    }
  }

  const loadBases = async () => {
    try {
      const response = await fetch('/api/bases')
      if (response.ok) {
        const data = await response.json()
        setBases(data)
      }
    } catch (error) {
      console.error('Failed to load bases:', error)
      toast.error('載入基地失敗')
    }
  }

  // Load existing schedule when week changes
  useEffect(() => {
    if (currentWeek && session?.user?.id) {
      loadWeekSchedule(currentWeek)
    }
  }, [currentWeek, session])

  const loadWeekSchedule = async (week: Date) => {
    setIsLoadingSchedule(true)
    try {
      const weekStartStr = week.toISOString().split('T')[0]
      const response = await fetch(`/api/weeks/${weekStartStr}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.schedule) {
          setSchedule(data.schedule)
          console.log(`載入 ${weekStartStr} 週課表:`, data.totalEvents || Object.keys(data.schedule).length, '個時段')
        } else {
          // 沒有資料時重置為空課表
          setSchedule(initializeEmptySchedule())
        }
      } else if (response.status === 404) {
        // 404 表示該週沒有課表資料，重置為空課表
        setSchedule(initializeEmptySchedule())
      } else {
        console.warn('載入週課表失敗:', response.status)
        toast.error('載入週課表失敗')
      }
    } catch (error) {
      console.error('載入週課表錯誤:', error)
      toast.error('載入週課表失敗')
      // 發生錯誤時也重置為空課表
      setSchedule(initializeEmptySchedule())
    } finally {
      setIsLoadingSchedule(false)
    }
  }

  const handlePreview = async () => {
    if (!currentWeek) return
    
    setIsLoading(true)
    try {
      const weekStartStr = currentWeek.toISOString().split('T')[0]
      
      const response = await fetch(`/api/weeks/${weekStartStr}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduleData: schedule
        }),
      })

      if (!response.ok) {
        throw new Error('Preview failed')
      }

      const data = await response.json()
      setPreviewChanges(data.changes)
    } catch (error) {
      console.error('Preview failed:', error)
      toast.error('預覽失敗，請檢查登入狀態並重試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    if (!previewChanges || !currentWeek) return
    
    setIsLoading(true)
    try {
      const weekStartStr = currentWeek.toISOString().split('T')[0]
      
      // 先保存當前課表資料
      await saveScheduleData(weekStartStr, schedule)
      
      // 然後同步到 Google Calendar
      const response = await fetch(`/api/weeks/${weekStartStr}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: previewChanges.create.concat(previewChanges.update),
          eventsToDelete: previewChanges.delete
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sync failed')
      }

      const data = await response.json()
      toast.success(data.message || '同步成功！')
      setPreviewChanges(undefined)
    } catch (error) {
      console.error('Sync failed:', error)
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      toast.error(`同步失敗：${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const saveScheduleData = async (weekStartStr: string, scheduleData: WeekSchedule) => {
    try {
      const response = await fetch('/api/weeks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session?.user?.id,
          weekStart: weekStartStr,
          data: scheduleData
        }),
      })

      if (!response.ok) {
        console.warn('保存課表資料失敗:', response.status)
      }
    } catch (error) {
      console.warn('保存課表資料錯誤:', error)
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
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold">ClassSync</h1>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
                <TabsList>
                  <TabsTrigger value="schedule">週課表</TabsTrigger>
                  <TabsTrigger value="courses">課程庫</TabsTrigger>
                  <TabsTrigger value="rooms">教室庫</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center space-x-4">
              <AuthButton />
            </div>
          </div>
          
          {/* Mobile navigation */}
          <div className="md:hidden pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="schedule" className="flex-1">週課表</TabsTrigger>
                <TabsTrigger value="courses" className="flex-1">課程庫</TabsTrigger>
                <TabsTrigger value="rooms" className="flex-1">教室庫</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 sm:p-6 pt-20 md:pt-24">
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
              />
              
              {isLoadingSchedule ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-muted-foreground">載入週課表中...</p>
                  </div>
                </div>
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
                        // 自動保存課表變更 (debounced)
                        if (currentWeek) {
                          const weekStartStr = currentWeek.toISOString().split('T')[0]
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
                      // 自動保存課表變更 (debounced)
                      if (currentWeek) {
                        const weekStartStr = currentWeek.toISOString().split('T')[0]
                        setTimeout(() => saveScheduleData(weekStartStr, newSchedule), 1000)
                      }
                    }}
                    currentWeek={currentWeek}
                  />
                </>
              )}
              
              <ScheduleActions
                onPreview={handlePreview}
                onSync={handleSync}
                previewChanges={previewChanges}
                isLoading={isLoading}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <CourseManager 
            courses={courses}
            onCoursesChange={setCourses}
          />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <RoomManager />
        </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
