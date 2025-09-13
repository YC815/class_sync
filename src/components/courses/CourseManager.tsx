'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, Link, Save, X } from 'lucide-react'
import { Course, CourseLink } from '@/lib/types'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import LinkNameSelect from './LinkNameSelect'

interface CourseManagerProps {
  courses: Course[]
  onCoursesChange: (courses: Course[]) => void
}

interface CourseFormData {
  name: string
  links: CourseLink[]
}

export default function CourseManager({ courses, onCoursesChange }: CourseManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    links: [{ id: '', name: '', url: '', order: 0 }]
  })
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const resetForm = () => {
    setFormData({ name: '', links: [{ id: '', name: '', url: '', order: 0 }] })
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
      links: course.links && course.links.length > 0 
        ? course.links.map(link => ({ ...link, id: link.id || '' }))
        : [{ id: '', name: '', url: '', order: 0 }]
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !session?.user?.id) return
    
    setIsLoading(true)
    
    try {
      const validLinks = formData.links.filter(link => 
        link.name.trim() && link.url.trim()
      ).map((link, index) => ({
        name: link.name.trim(),
        url: link.url.trim(),
        order: index
      }))

      const courseData = {
        name: formData.name.trim(),
        links: validLinks.length > 0 ? validLinks : undefined
      }

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

  const handleDelete = async (courseId: string) => {
    if (!confirm('確定要刪除這個課程嗎？')) return
    
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete course')
      }

      const newCourses = courses.filter(c => c.id !== courseId)
      onCoursesChange(newCourses)
      toast.success('課程已刪除')
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
              <DialogDescription>
                {editingCourse ? '編輯課程資訊及相關連結' : '建立新的課程並添加相關連結'}
              </DialogDescription>
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
                <Label>課程連結</Label>
                <div className="space-y-3">
                  {formData.links.map((link, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <LinkNameSelect
                          value={link.name}
                          onChange={(newName) => {
                            const newLinks = [...formData.links]
                            newLinks[index].name = newName
                            setFormData({ ...formData, links: newLinks })
                          }}
                          placeholder="選擇連結名稱"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="連結網址"
                          type="url"
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...formData.links]
                            newLinks[index].url = e.target.value
                            setFormData({ ...formData, links: newLinks })
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (formData.links.length > 1) {
                            const newLinks = formData.links.filter((_, i) => i !== index)
                            setFormData({ ...formData, links: newLinks })
                          }
                        }}
                        disabled={formData.links.length === 1}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        links: [...formData.links, { id: '', name: '', url: '', order: formData.links.length }]
                      })
                    }}
                    className="w-full"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    新增連結
                  </Button>
                </div>
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
              <TableHead className="font-semibold">連結</TableHead>
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
                  {course.links && course.links.length > 0 ? (
                    <div className="space-y-1">
                      {course.links.map((link, index) => (
                        <div key={link.id || index} className="flex items-center gap-2">
                          <Link className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{link.name}: </span>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-blue-500 hover:underline"
                            >
                              {link.url}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">無連結</span>
                  )}
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
    </div>
  )
}