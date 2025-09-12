'use client'

import React, { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Trash2, MapPin } from 'lucide-react'
import { BASES, ROOMS_BY_BASE, BaseType, BASE_INFO } from '@/lib/types'

interface Room {
  id: string
  name: string
  base: string
  capacity?: number
  equipment?: string[]
}

interface RoomManagerProps {
  rooms?: Room[]
  onRoomsChange?: (rooms: Room[]) => void
}

export default function RoomManager({ 
  rooms = [], 
  onRoomsChange = () => {} 
}: RoomManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    base: '',
    capacity: '',
    equipment: ''
  })

  // 初始化預設教室數據
  const initialRooms: Room[] = [
    ...ROOMS_BY_BASE.hongdao.map(room => ({
      id: `hongdao-${room}`,
      name: room,
      base: 'hongdao',
      capacity: 30
    })),
    ...ROOMS_BY_BASE.jilin.map(room => ({
      id: `jilin-${room}`,
      name: room,
      base: 'jilin',
      capacity: 25
    }))
  ]

  const currentRooms = rooms.length > 0 ? rooms : initialRooms

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.base) return

    const roomData: Room = {
      id: editingRoom?.id || `${formData.base}-${formData.name}-${Date.now()}`,
      name: formData.name,
      base: formData.base,
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      equipment: formData.equipment ? formData.equipment.split(',').map(s => s.trim()) : undefined
    }

    let newRooms
    if (editingRoom) {
      newRooms = currentRooms.map(room => 
        room.id === editingRoom.id ? roomData : room
      )
    } else {
      newRooms = [...currentRooms, roomData]
    }

    onRoomsChange(newRooms)
    resetForm()
    setIsDialogOpen(false)
  }

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setFormData({
      name: room.name,
      base: room.base,
      capacity: room.capacity?.toString() || '',
      equipment: room.equipment?.join(', ') || ''
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (roomId: string) => {
    if (confirm('確定要刪除這個教室嗎？')) {
      const newRooms = currentRooms.filter(room => room.id !== roomId)
      onRoomsChange(newRooms)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      base: '',
      capacity: '',
      equipment: ''
    })
    setEditingRoom(null)
  }

  const getBaseName = (baseValue: string) => {
    return Object.keys(BASES).find(key => BASES[key as BaseType] === baseValue) || baseValue
  }

  const groupedRooms = currentRooms.reduce((acc, room) => {
    const baseName = getBaseName(room.base)
    if (!acc[baseName]) acc[baseName] = []
    acc[baseName].push(room)
    return acc
  }, {} as Record<string, Room[]>)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">教室庫管理</h2>
          <p className="text-muted-foreground">管理各基地的教室資訊</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              新增教室
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? '編輯教室' : '新增教室'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">教室名稱</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：201, A1"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="base">基地</Label>
                <Select 
                  value={formData.base} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, base: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇基地" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BASES).map(([baseName, baseValue]) => (
                      <SelectItem key={baseValue} value={baseValue}>
                        {baseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">容納人數</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder="例如：30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment">設備 (用逗號分隔)</Label>
                <Input
                  id="equipment"
                  value={formData.equipment}
                  onChange={(e) => setFormData(prev => ({ ...prev, equipment: e.target.value }))}
                  placeholder="例如：投影機, 白板, 電腦"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit">
                  {editingRoom ? '更新' : '新增'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedRooms).map(([baseName, baseRooms]) => {
          const baseValue = BASES[baseName as BaseType] 
          const baseInfo = BASE_INFO[baseValue]
          
          return (
            <div key={baseName} className="space-y-3">
              <div className="flex items-start gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{baseName}</h3>
                  {baseInfo?.address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{baseInfo.address}</span>
                    </div>
                  )}
                  {baseInfo?.placeId && (
                    <div className="text-xs text-muted-foreground">
                      Place ID: {baseInfo.placeId}
                    </div>
                  )}
                </div>
              </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>教室名稱</TableHead>
                    <TableHead>容納人數</TableHead>
                    <TableHead>設備</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baseRooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">
                        {room.name}
                      </TableCell>
                      <TableCell>
                        {room.capacity ? `${room.capacity} 人` : '未設定'}
                      </TableCell>
                      <TableCell>
                        {room.equipment ? room.equipment.join(', ') : '無'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(room)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(room.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}