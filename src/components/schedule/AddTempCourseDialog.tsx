'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface AddTempCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddCourse: (courseName: string) => void
}

export default function AddTempCourseDialog({
  open,
  onOpenChange,
  onAddCourse
}: AddTempCourseDialogProps) {
  const [courseName, setCourseName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (courseName.trim()) {
      onAddCourse(courseName.trim())
      setCourseName('')
      onOpenChange(false)
      toast.success('臨時課程已新增')
    }
  }

  const handleCancel = () => {
    setCourseName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新增臨時課程</DialogTitle>
            <DialogDescription>
              輸入臨時課程的名稱，這個課程將會被加到目前選擇的時段。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="course-name">課程名稱</Label>
              <Input
                id="course-name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="請輸入課程名稱"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button type="submit" disabled={!courseName.trim()}>
              新增課程
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}