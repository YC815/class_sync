'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit2, Trash2, Save } from 'lucide-react'
import { Course } from '@/lib/types'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface CourseManagerProps {
  courses: Course[]
  onCoursesChange: (courses: Course[]) => void
}

interface CourseFormData {
  name: string
}

export default function CourseManager({ courses, onCoursesChange }: CourseManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
  })
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null)

  const resetForm = () => {
    setFormData({ name: '' })
    setEditingCourse(null)
  }

  const openNewCourseDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (course: Course) => {
    setEditingCourse(course)
    setFormData({ name: course.name })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !session?.user?.id) return
    
    setIsLoading(true)
    
    try {
      const courseData = { name: formData.name.trim() }

      let response
      if (editingCourse) {
        // Update existing course
        response = await fetch(`/api/courses/${editingCourse.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(courseData),
        })
      } else {
        // Create new course
        response = await fetch('/api/courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(courseData),
        })
      }

      if (!response.ok) {
        throw new Error('Failed to save course')
      }

      const updatedCourse = await response.json()
      
      // Update courses list
      const newCourses = editingCourse 
        ? courses.map(c => c.id === editingCourse.id ? updatedCourse : c)
        : [...courses, updatedCourse]
      
      onCoursesChange(newCourses)
      toast.success(editingCourse ? '課程已更新' : '課程已新增')
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Failed to save course:', error)
      toast.error('儲存失敗，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (courseId: string) => {
    setCourseToDelete(courseId)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!courseToDelete) return

    try {
      const response = await fetch(`/api/courses/${courseToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete course')
      }

      const newCourses = courses.filter(c => c.id !== courseToDelete)
      onCoursesChange(newCourses)
      toast.success('課程已刪除')
      setShowDeleteDialog(false)
      setCourseToDelete(null)
    } catch (error) {
      console.error('Failed to delete course:', error)
      toast.error('刪除失敗，請稍後再試')
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
          <p className="text-muted-foreground">管理課程庫</p>
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
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDialogClose}
                >
                  取消
                </Button>
                <Button type="submit" className="gap-2" disabled={isLoading}>
                  <Save className="w-4 h-4" />
                  {isLoading ? '儲存中...' : (editingCourse ? '更新' : '新增')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Courses List */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">課程名稱</TableHead>
              <TableHead className="w-24 text-center font-semibold">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">
                  {course.name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(course)}
                      title="編輯課程"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(course.id)}
                      title="刪除課程"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {courses.length === 0 && (
        <div className="border rounded-lg">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">尚無課程</h3>
            <p className="text-muted-foreground mb-4">點擊「新增課程」開始建立課程庫</p>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除課程</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個課程嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}