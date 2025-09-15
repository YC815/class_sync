'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ChevronDown, LogOut, Settings, RefreshCw, Shield } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface UserAccountDropdownProps {
  onTestReset?: () => Promise<void>
  onRecover?: () => void
  isResetting?: boolean
  isLoading?: boolean
}

export default function UserAccountDropdown({ onTestReset, onRecover, isResetting = false, isLoading = false }: UserAccountDropdownProps) {
  const { data: session, status } = useSession()
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  if (status === 'loading') {
    return (
      <Button variant="outline" disabled className="gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        載入中...
      </Button>
    )
  }

  if (!session) {
    return null
  }

  const userImage = session.user?.image
  const userName = session.user?.name || '用戶'

  // 產生首字母頭像背景顏色
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ]
    const hash = name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  const handleResetData = async () => {
    if (onTestReset) {
      try {
        await onTestReset()
        setShowResetDialog(false)
      } catch (error) {
        console.error('Reset failed:', error)
        toast.error('重置失敗，請重試')
      }
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 hover:bg-gray-50"
          >
            {userImage ? (
              <img
                src={userImage}
                alt={userName}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(userName)}`}>
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm hidden sm:inline">{userName}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {onRecover && (
            <>
              <DropdownMenuItem
                onClick={onRecover}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                恢復事件
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem asChild>
            <Link href="/privacy" className="gap-2 w-full">
              <Shield className="w-4 h-4" />
              隱私權政策
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => signOut()} className="gap-2">
            <LogOut className="w-4 h-4" />
            登出
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowAdvancedSettings(true)}
            className="gap-2 text-orange-600 hover:text-orange-700 focus:text-orange-700"
          >
            <Settings className="w-4 h-4" />
            進階設定
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 進階設定對話框 */}
      <Dialog open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>進階設定</DialogTitle>
            <DialogDescription>
              管理您的帳號設定和資料
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">資料管理</h4>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowAdvancedSettings(false)
                  setShowResetDialog(true)
                }}
                className="w-full"
              >
                重置資料
              </Button>
              <p className="text-xs text-muted-foreground">
                清除所有課表和Google Calendar事件，重置為預設狀態
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 重置資料確認對話框 */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認重置資料</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將會執行以下動作，請謹慎確認。
            </AlertDialogDescription>
            <div className="space-y-2 text-sm">
              <ul className="list-disc list-inside space-y-1">
                <li className="text-red-600">刪除所有Google Calendar事件</li>
                <li className="text-red-600">清除所有週課表資料</li>
                <li className="text-red-600">重置教室為預設值（吉林、弘道、線上）</li>
                <li className="text-green-600">保留所有課程資料</li>
              </ul>
              <div className="text-red-600 font-semibold mt-4">
                ⚠️ 此操作無法復原，請謹慎使用！
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetData}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isResetting ? '重置中...' : '確認重置'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}