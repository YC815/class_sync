'use client'

import React, { useState, useEffect } from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, MapPin } from 'lucide-react'
import { Base } from '@/lib/types'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export default function RoomManager() {
  const { data: session } = useSession()
  const [bases, setBases] = useState<Base[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBase, setEditingBase] = useState<Base | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    placeId: '',
    rooms: [''] // 至少一個教室輸入框
  })

  // 載入基地資料
  useEffect(() => {
    if (session?.user?.id) {
      loadBases()
    }
  }, [session])

  const loadBases = async () => {
    try {
      const response = await fetch('/api/bases')
      if (response.ok) {
        const data = await response.json()
        setBases(data)
      }
    } catch (error) {
      console.error('Failed to load bases:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !session?.user?.id) return
    
    setIsLoading(true)
    
    try {
      const validRooms = formData.rooms.filter(room => room.trim())
      
      const baseData = {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        placeId: formData.placeId.trim() || undefined,
        rooms: validRooms.length > 0 ? validRooms : undefined
      }

      let response
      if (editingBase) {
        response = await fetch(`/api/bases/${editingBase.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(baseData),
        })
      } else {
        response = await fetch('/api/bases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(baseData),
        })
      }

      if (!response.ok) {
        throw new Error('Failed to save base')
      }

      await loadBases() // 重新載入資料
      toast.success(editingBase ? '基地已更新' : '基地已新增')
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to save base:', error)
      toast.error('儲存失敗，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (base: Base) => {
    setEditingBase(base)
    setFormData({
      name: base.name,
      address: base.address || '',
      placeId: base.placeId || '',
      rooms: base.rooms && base.rooms.length > 0 
        ? base.rooms.map(room => room.name)
        : ['']
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (baseId: string) => {
    if (!confirm('確定要刪除這個基地嗎？所有相關教室也會被刪除。')) return
    
    try {
      const response = await fetch(`/api/bases/${baseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete base')
      }

      await loadBases()
      toast.success('基地已刪除')
    } catch (error) {
      console.error('Failed to delete base:', error)
      toast.error('刪除失敗，請稍後再試')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      placeId: '',
      rooms: ['']
    })
    setEditingBase(null)
  }

  const addRoomField = () => {
    setFormData({
      ...formData,
      rooms: [...formData.rooms, '']
    })
  }

  const removeRoomField = (index: number) => {
    if (formData.rooms.length > 1) {
      const newRooms = formData.rooms.filter((_, i) => i !== index)
      setFormData({ ...formData, rooms: newRooms })
    }
  }

  const updateRoomField = (index: number, value: string) => {
    const newRooms = [...formData.rooms]
    newRooms[index] = value
    setFormData({ ...formData, rooms: newRooms })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">基地教室管理</h2>
          <p className="text-muted-foreground">管理基地與教室資訊，支援字串名稱顯示</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              新增基地
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBase ? '編輯基地' : '新增基地'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">基地名稱 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：弘道基地、吉林基地、線上、其他"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">地址</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="基地地址（選填）"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="placeId">Google Place ID</Label>
                <Input
                  id="placeId"
                  value={formData.placeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, placeId: e.target.value }))}
                  placeholder="Google Places API ID（選填）"
                />
              </div>
              
              <div>
                <Label>教室列表</Label>
                <div className="space-y-2">
                  {formData.rooms.map((room, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={room}
                        onChange={(e) => updateRoomField(index, e.target.value)}
                        placeholder="教室名稱（如：201、A1）"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeRoomField(index)}
                        disabled={formData.rooms.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRoomField}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    新增教室
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '儲存中...' : (editingBase ? '更新' : '新增')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {bases.map((base) => (
          <div key={base.id} className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{base.name}</h3>
                {base.address && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{base.address}</span>
                  </div>
                )}
                {base.placeId && (
                  <div className="text-xs text-muted-foreground">
                    Place ID: {base.placeId}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(base)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(base.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {base.rooms && base.rooms.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>教室名稱</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {base.rooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">
                          {room.name}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground ml-4">此基地尚無教室</p>
            )}
          </div>
        ))}
        
        {bases.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">尚無基地</h3>
            <p className="text-muted-foreground mb-4">點擊「新增基地」開始管理基地教室</p>
          </div>
        )}
      </div>
    </div>
  )
}