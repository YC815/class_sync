'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit2, Trash2, Link, Save, X } from 'lucide-react'
import { Course } from '@/lib/types'

interface CourseManagerProps {
  courses: Course[]
  onCoursesChange: (courses: Course[]) => void
}

interface CourseFormData {
  name: string
  defaultUrl: string
}

export default function CourseManager({ courses, onCoursesChange }: CourseManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    defaultUrl: ''
  })

  const resetForm = () => {
    setFormData({ name: '', defaultUrl: '' })
    setEditingCourse(null)
  }

  const openNewCourseDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      name: course.name,
      defaultUrl: course.defaultUrl || ''
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) return

    const newCourses = [...courses]
    
    if (editingCourse) {
      // Update existing course
      const index = newCourses.findIndex(c => c.id === editingCourse.id)
      if (index >= 0) {
        newCourses[index] = {
          ...editingCourse,
          name: formData.name.trim(),
          defaultUrl: formData.defaultUrl.trim() || undefined
        }
      }
    } else {
      // Add new course
      const newCourse: Course = {
        id: Date.now().toString(), // Simple ID generation for demo
        name: formData.name.trim(),
        defaultUrl: formData.defaultUrl.trim() || undefined
      }
      newCourses.push(newCourse)
    }

    onCoursesChange(newCourses)
    setIsDialogOpen(false)
    resetForm()
  }

  const handleDelete = (courseId: string) => {
    if (confirm('確定要刪除這個課程嗎？')) {
      const newCourses = courses.filter(c => c.id !== courseId)
      onCoursesChange(newCourses)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">課程管理</h2>
          <p className="text-muted-foreground">管理課程庫，設定預設連結</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewCourseDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              新增課程
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCourse ? '編輯課程' : '新增課程'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">課程名稱 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="輸入課程名稱"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="defaultUrl">預設連結</Label>
                <Input
                  id="defaultUrl"
                  value={formData.defaultUrl}
                  onChange={(e) => setFormData({ ...formData, defaultUrl: e.target.value })}
                  placeholder="https://example.com/course-link"
                  type="url"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDialogClose}
                >
                  取消
                </Button>
                <Button type="submit" className="gap-2">
                  <Save className="w-4 h-4" />
                  {editingCourse ? '更新' : '新增'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Courses List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{course.name}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(course)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(course.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {course.defaultUrl ? (
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-blue-500" />
                  <a 
                    href={course.defaultUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline truncate"
                  >
                    {course.defaultUrl}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">無預設連結</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">尚無課程</h3>
          <p className="text-muted-foreground mb-4">點擊「新增課程」開始建立課程庫</p>
        </div>
      )}
    </div>
  )
}