'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { LinkType } from '@/lib/types'
import { toast } from 'sonner'

interface LinkNameSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function LinkNameSelect({ value, onChange, placeholder = "選擇連結名稱" }: LinkNameSelectProps) {
  const [linkTypes, setLinkTypes] = useState<LinkType[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newLinkTypeName, setNewLinkTypeName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchLinkTypes()
  }, [])

  const fetchLinkTypes = async () => {
    try {
      const response = await fetch('/api/link-types')
      if (response.ok) {
        const types = await response.json()
        setLinkTypes(types)
      }
    } catch (error) {
      console.error('Failed to fetch link types:', error)
    }
  }

  const handleAddNewType = async () => {
    if (!newLinkTypeName.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/link-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newLinkTypeName.trim() })
      })

      if (response.ok) {
        const newType = await response.json()
        setLinkTypes([...linkTypes, newType])
        onChange(newType.name)
        setIsAddDialogOpen(false)
        setNewLinkTypeName('')
        toast.success('已新增連結類型')
      } else {
        const error = await response.json()
        toast.error(error.error || '新增失敗')
      }
    } catch (error) {
      console.error('Failed to add link type:', error)
      toast.error('新增失敗，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleValueChange = (newValue: string) => {
    if (newValue === '__add_new__') {
      setIsAddDialogOpen(true)
    } else {
      onChange(newValue)
    }
  }

  return (
    <>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {linkTypes.map((type) => (
            <SelectItem key={type.id} value={type.name}>
              {type.name}
            </SelectItem>
          ))}
          <SelectItem value="__add_new__" className="font-medium text-blue-600">
            <div className="flex items-center gap-2">
              <Plus className="w-3 h-3" />
              新增項目
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增連結類型</DialogTitle>
            <DialogDescription>
              輸入新的連結類型名稱，將會新增到下拉選單中
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="輸入連結類型名稱"
              value={newLinkTypeName}
              onChange={(e) => setNewLinkTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddNewType()
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false)
                  setNewLinkTypeName('')
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleAddNewType}
                disabled={!newLinkTypeName.trim() || isLoading}
              >
                {isLoading ? '新增中...' : '新增'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}