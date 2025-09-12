'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ScheduleTable from '@/components/schedule/ScheduleTable'
import WeekNavigation from '@/components/schedule/WeekNavigation'
import ScheduleActions from '@/components/schedule/ScheduleActions'
import CourseManager from '@/components/courses/CourseManager'
import AuthButton from '@/components/auth/AuthButton'
import { WeekSchedule, Course, LocationBase, ScheduleEvent } from '@/lib/types'
import { getWeekStart, initializeEmptySchedule } from '@/lib/schedule-utils'

// Mock data for development
const mockCourses: Course[] = [
  { id: '1', name: 'React 基礎', defaultUrl: 'https://example.com/react' },
  { id: '2', name: 'TypeScript 進階', defaultUrl: 'https://example.com/typescript' },
  { id: '3', name: 'Next.js 實戰' },
  { id: '4', name: 'UI/UX 設計' },
]

export default function Home() {
  const { data: session, status } = useSession()
  const [currentWeek, setCurrentWeek] = useState<Date>(() => getWeekStart(new Date()))
  const [schedule, setSchedule] = useState<WeekSchedule>(initializeEmptySchedule())
  const [courses, setCourses] = useState<Course[]>(mockCourses)
  const [currentLocation, setCurrentLocation] = useState<LocationBase>()
  const [previewChanges, setPreviewChanges] = useState<{
    create: ScheduleEvent[]
    update: ScheduleEvent[]
    delete: string[]
  }>()
  const [isLoading, setIsLoading] = useState(false)

  const handlePreview = async () => {
    setIsLoading(true)
    try {
      const weekStartStr = currentWeek.toISOString().split('T')[0]
      
      const response = await fetch(`/api/weeks/${weekStartStr}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduleData: schedule,
          currentLocation
        }),
      })

      if (!response.ok) {
        throw new Error('Preview failed')
      }

      const data = await response.json()
      setPreviewChanges(data.changes)
    } catch (error) {
      console.error('Preview failed:', error)
      alert('預覽失敗，請檢查登入狀態並重試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    if (!previewChanges) return
    
    setIsLoading(true)
    try {
      const weekStartStr = currentWeek.toISOString().split('T')[0]
      
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
      alert(data.message || '同步成功！')
      setPreviewChanges(undefined)
    } catch (error) {
      console.error('Sync failed:', error)
      alert(`同步失敗：${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyWeek = async () => {
    setIsLoading(true)
    try {
      // Mock copy week logic
      await new Promise(resolve => setTimeout(resolve, 500))
      alert('已複製到下週')
    } catch (error) {
      console.error('Copy week failed:', error)
      alert('複製失敗')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
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
            <h1 className="text-3xl font-bold mb-2">排課系統 × Google Calendar 同步</h1>
            <p className="text-muted-foreground">請先登入 Google 帳號以開始使用</p>
          </div>
          <AuthButton />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">排課系統 × Google Calendar 同步</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">管理週課表並同步至 Google Calendar</p>
        </div>
        <div className="sm:flex-shrink-0">
          <AuthButton />
        </div>
      </header>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">週課表</TabsTrigger>
          <TabsTrigger value="courses">課程庫</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          <WeekNavigation 
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
          />
          
          <ScheduleTable
            schedule={schedule}
            courses={courses}
            onScheduleChange={setSchedule}
            currentLocation={currentLocation}
            onLocationChange={setCurrentLocation}
          />
          
          <ScheduleActions
            onPreview={handlePreview}
            onSync={handleSync}
            onCopyWeek={handleCopyWeek}
            previewChanges={previewChanges}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <CourseManager 
            courses={courses}
            onCoursesChange={setCourses}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
