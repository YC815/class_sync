'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Trash2, MapPin, Check, X } from 'lucide-react'
import { Base } from '@/lib/types'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface RoomManagerProps {
  bases: Base[]
  onBasesChange: (bases: Base[]) => void
  initialLoading?: boolean
  onLoadingChange?: (loading: boolean) => void
  refreshInterval?: number
}

const RoomManager = React.forwardRef<
  { refreshBases: () => Promise<void> },
  RoomManagerProps
>(({
  bases,
  onBasesChange,
  initialLoading = false,
  onLoadingChange,
  refreshInterval
}, ref) => {
  const { data: session } = useSession()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBase, setEditingBase] = useState<Base | null>(null)
  const [isLoading, setIsLoading] = useState(initialLoading)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editingRoomName, setEditingRoomName] = useState('')
  const [showDeleteBaseDialog, setShowDeleteBaseDialog] = useState(false)
  const [showDeleteRoomDialog, setShowDeleteRoomDialog] = useState(false)
  const [baseToDelete, setBaseToDelete] = useState<string | null>(null)
  const [roomToDelete, setRoomToDelete] = useState<{id: string, name: string} | null>(null)
  const [userIsInteracting, setUserIsInteracting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    placeId: '',
    isSingleRoom: false,
    rooms: [] as string[]
  })
  const [currentRoomInput, setCurrentRoomInput] = useState('')

  // 更新loading狀態
  const updateLoading = useCallback((loading: boolean) => {
    setIsLoading(loading)
    onLoadingChange?.(loading)
  }, [onLoadingChange])

  // 刷新基地資料的回調函數
  const refreshBases = useCallback(async (showLoading = true) => {
    console.log('🔄 [RoomManager] refreshBases called')
    if (showLoading) {
      updateLoading(true)
    }
    try {
      const response = await fetch('/api/bases')
      if (response.ok) {
        const data = await response.json()
        const bases = data.bases || data
        console.log(`✅ [RoomManager] Received ${bases.length} bases from refresh`)
        onBasesChange(bases)
        return bases
      }
    } catch (error) {
      console.error('❌ [RoomManager] Failed to refresh bases:', error)
    } finally {
      if (showLoading) {
        updateLoading(false)
      }
    }
  }, [onBasesChange, updateLoading])

  // 自動刷新功能 - 只在用戶未進行操作時執行
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        // 只在用戶未進行互動、沒有對話框開啟、沒有編輯狀態時刷新
        if (!userIsInteracting && !isDialogOpen && !editingRoomId && !showDeleteBaseDialog && !showDeleteRoomDialog) {
          refreshBases(false) // 自動刷新時不顯示loading
        }
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [refreshInterval, refreshBases, userIsInteracting, isDialogOpen, editingRoomId, showDeleteBaseDialog, showDeleteRoomDialog])

  // 監聽bases的變化來更新內部狀態
  useEffect(() => {
    if (initialLoading !== isLoading) {
      setIsLoading(initialLoading)
    }
  }, [initialLoading, isLoading])

  // 將刷新功能暴露給父組件
  React.useImperativeHandle(ref, () => ({
    refreshBases: () => refreshBases(true)
  }), [refreshBases])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !session?.user?.id) return

    setUserIsInteracting(true)
    updateLoading(true)
    
    try {
      const baseData = {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        placeId: formData.placeId.trim() || undefined,
        isSingleRoom: formData.isSingleRoom,
        rooms: formData.isSingleRoom ? undefined : (formData.rooms.length > 0 ? formData.rooms : undefined)
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

      await refreshBases(false) // 重新載入資料，不顯示loading
      toast.success(editingBase ? '基地已更新' : '基地已新增')
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to save base:', error)
      toast.error('儲存失敗，請稍後再試')
    } finally {
      updateLoading(false)
      setUserIsInteracting(false)
    }
  }

  const handleEdit = (base: Base) => {
    setEditingBase(base)
    setFormData({
      name: base.name,
      address: base.address || '',
      placeId: base.placeId || '',
      isSingleRoom: base.isSingleRoom || false,
      rooms: base.rooms && base.rooms.length > 0 
        ? base.rooms.map(room => room.name)
        : []
    })
    setCurrentRoomInput('')
    setIsDialogOpen(true)
  }

  const handleDelete = (baseId: string) => {
    setBaseToDelete(baseId)
    setShowDeleteBaseDialog(true)
  }

  const confirmDeleteBase = async () => {
    if (!baseToDelete) return

    try {
      const response = await fetch(`/api/bases/${baseToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete base')
      }

      await refreshBases(false)
      toast.success('基地已刪除')
      setShowDeleteBaseDialog(false)
      setBaseToDelete(null)
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
      isSingleRoom: false,
      rooms: []
    })
    setCurrentRoomInput('')
    setEditingBase(null)
  }

  const addRoom = () => {
    if (currentRoomInput.trim()) {
      setFormData({
        ...formData,
        rooms: [...formData.rooms, currentRoomInput.trim()]
      })
      setCurrentRoomInput('')
    }
  }

  const removeRoom = (index: number) => {
    const newRooms = formData.rooms.filter((_, i) => i !== index)
    setFormData({ ...formData, rooms: newRooms })
  }

  // 開始編輯教室名稱
  const startEditingRoom = (roomId: string, currentName: string) => {
    setEditingRoomId(roomId)
    setEditingRoomName(currentName)
  }

  // 取消編輯教室名稱
  const cancelEditingRoom = () => {
    setEditingRoomId(null)
    setEditingRoomName('')
  }

  // 保存教室名稱
  const saveRoomName = async (roomId: string) => {
    if (!editingRoomName.trim()) {
      toast.error('教室名稱不能為空')
      return
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingRoomName.trim()
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update room name')
      }

      await refreshBases(false) // 重新載入資料
      toast.success('教室名稱已更新')
      setEditingRoomId(null)
      setEditingRoomName('')
    } catch (error) {
      console.error('Failed to update room name:', error)
      toast.error('更新失敗，請稍後再試')
    }
  }

  // 刪除教室
  const deleteRoom = (roomId: string, roomName: string) => {
    setRoomToDelete({id: roomId, name: roomName})
    setShowDeleteRoomDialog(true)
  }

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return

    try {
      const response = await fetch(`/api/rooms/${roomToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete room')
      }

      await refreshBases(false)
      toast.success('教室已刪除')
      setShowDeleteRoomDialog(false)
      setRoomToDelete(null)
    } catch (error) {
      console.error('Failed to delete room:', error)
      toast.error('刪除失敗，請稍後再試')
    }
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
                  onFocus={() => setUserIsInteracting(true)}
                  onBlur={() => setUserIsInteracting(false)}
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
                  onFocus={() => setUserIsInteracting(true)}
                  onBlur={() => setUserIsInteracting(false)}
                  placeholder="基地地址（選填）"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="placeId">Google Place ID</Label>
                <Input
                  id="placeId"
                  value={formData.placeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, placeId: e.target.value }))}
                  onFocus={() => setUserIsInteracting(true)}
                  onBlur={() => setUserIsInteracting(false)}
                  placeholder="Google Places API ID（選填）"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseType">基地類型 *</Label>
                <Select
                  value={formData.isSingleRoom ? 'single' : 'multiple'}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    isSingleRoom: value === 'single',
                    rooms: value === 'single' ? [''] : prev.rooms
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇基地類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">單教室基地</SelectItem>
                    <SelectItem value="multiple">多教室基地</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  單教室基地：選擇課程時不會出現教室選項
                </p>
              </div>
              
              {!formData.isSingleRoom && (
                <div>
                  <Label>教室列表</Label>
                  <div className="border rounded-lg bg-muted/20">
                    {/* 可捲動的已添加教室區域 */}
                    {formData.rooms.length > 0 && (
                      <div className="p-3 max-h-32 overflow-y-auto border-b">
                        <div className="grid grid-cols-2 gap-2">
                          {formData.rooms.map((room, index) => (
                            <div key={index} className="flex items-center justify-between bg-background border rounded-md px-2 py-1.5 shadow-sm">
                              <span className="text-xs font-medium truncate">{room}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRoom(index)}
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive ml-1 flex-shrink-0"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 新增教室輸入框 - 固定在底部 */}
                    <div className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={currentRoomInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            // 檢測是否包含換行符（中文輸入法按Enter後的結果）
                            if (value.includes('\n')) {
                              const roomName = value.replace('\n', '').trim();
                              if (roomName) {
                                setFormData(prev => ({
                                  ...prev,
                                  rooms: [...prev.rooms, roomName]
                                }));
                                setCurrentRoomInput('');
                              }
                            } else {
                              setCurrentRoomInput(value);
                            }
                          }}
                          onFocus={() => setUserIsInteracting(true)}
                          onBlur={() => setUserIsInteracting(false)}
                          placeholder="輸入新教室名稱..."
                          className="flex-1"
                          onCompositionStart={(e) => {
                            // 中文輸入開始，設置標記
                            e.currentTarget.dataset.composing = 'true';
                          }}
                          onCompositionEnd={(e) => {
                            // 中文輸入結束，清除標記
                            e.currentTarget.dataset.composing = 'false';
                          }}
                          onKeyDown={(e) => {
                            // 只有在非中文輸入狀態下才處理Enter
                            if (e.key === 'Enter' && e.currentTarget.dataset.composing !== 'true') {
                              if (currentRoomInput.trim()) {
                                e.preventDefault();
                                addRoom();
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addRoom}
                          disabled={!currentRoomInput.trim()}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* 空狀態提示 */}
                      {formData.rooms.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          輸入教室名稱後點擊 + 號添加，或按 Enter 鍵快速添加
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

      <div className="grid gap-6">
        {bases.map((base) => (
          <Card key={base.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl">{base.name}</CardTitle>
                  {base.address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{base.address}</span>
                    </div>
                  )}
                  {base.placeId && (
                    <div className="text-xs text-muted-foreground">
                      Place ID: {base.placeId}
                    </div>
                  )}
                  {base.isSingleRoom && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      📍 單教室基地
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
            </CardHeader>
            
            <CardContent>
              {base.isSingleRoom ? (<div></div>
              ) : base.rooms && base.rooms.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold text-foreground">
                          教室名稱
                        </TableHead>
                        <TableHead className="w-24 font-semibold text-foreground">
                          操作
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {base.rooms.map((room) => (
                        <TableRow key={room.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium py-3">
                            {editingRoomId === room.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingRoomName}
                                  onChange={(e) => setEditingRoomName(e.target.value)}
                                  onFocus={() => setUserIsInteracting(true)}
                                  onBlur={() => setUserIsInteracting(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveRoomName(room.id)
                                    } else if (e.key === 'Escape') {
                                      cancelEditingRoom()
                                    }
                                  }}
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditingRoom(room.id, room.name)}
                                className="text-left hover:text-primary transition-colors cursor-text w-full"
                                title="點擊編輯教室名稱"
                              >
                                {room.name}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRoomId === room.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveRoomName(room.id)}
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEditingRoom}
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditingRoom(room.id, room.name)}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                  title="編輯教室名稱"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteRoom(room.id, room.name)}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  title="刪除教室"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  此基地尚無教室
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {bases.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">尚無基地</h3>
              <p className="text-muted-foreground mb-4">點擊「新增基地」開始管理基地教室</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Base Confirmation Dialog */}
      <AlertDialog open={showDeleteBaseDialog} onOpenChange={setShowDeleteBaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除基地</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個基地嗎？所有相關教室也會被刪除。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Room Confirmation Dialog */}
      <AlertDialog open={showDeleteRoomDialog} onOpenChange={setShowDeleteRoomDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除教室</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除教室「{roomToDelete?.name}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})

RoomManager.displayName = 'RoomManager'

export default RoomManager