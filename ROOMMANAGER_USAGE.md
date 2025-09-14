# RoomManager 使用說明

RoomManager 已修改為支援 props 和智能自動刷新。

## 新增的 Props

```typescript
interface RoomManagerProps {
  bases: Base[]                              // 基地數據
  onBasesChange: (bases: Base[]) => void     // 基地數據變更回調
  initialLoading?: boolean                   // 初始載入狀態
  onLoadingChange?: (loading: boolean) => void // 載入狀態變更回調
  refreshInterval?: number                   // 自動刷新間隔 (毫秒)
}
```

## 基本使用

```tsx
import { useState } from 'react'
import RoomManager from '@/components/rooms/RoomManager'
import { Base } from '@/lib/types'

function App() {
  const [bases, setBases] = useState<Base[]>([])
  const [isLoading, setIsLoading] = useState(false)

  return (
    <RoomManager
      bases={bases}
      onBasesChange={setBases}
      initialLoading={isLoading}
      onLoadingChange={setIsLoading}
    />
  )
}
```

## 使用 useRef 獲取組件實例

```tsx
import { useRef } from 'react'

function App() {
  const roomManagerRef = useRef<{ refreshBases: () => Promise<void> }>(null)

  const handleManualRefresh = () => {
    roomManagerRef.current?.refreshBases()
  }

  return (
    <div>
      <button onClick={handleManualRefresh}>手動刷新基地</button>
      <RoomManager
        ref={roomManagerRef}
        bases={bases}
        onBasesChange={setBases}
      />
    </div>
  )
}
```

## 智能自動刷新功能

```tsx
<RoomManager
  bases={bases}
  onBasesChange={setBases}
  refreshInterval={30000} // 每30秒自動刷新一次
/>
```

## 新增功能

1. **智能自動刷新** - 只在用戶未進行操作時執行自動刷新，避免干擾用戶
2. **用戶互動檢測** - 檢測表單輸入、對話框開啟、編輯狀態等，暫停自動刷新
3. **動態 loading 狀態** - 可通過 props 控制載入狀態
4. **ref 暴露功能** - 父組件可調用刷新方法
5. **更好的錯誤處理** - 刷新時不會覆蓋父組件的載入狀態

## 智能刷新邏輯

自動刷新會在以下情況暫停，確保不干擾用戶操作：

- 用戶正在輸入表單內容
- 任何對話框處於開啟狀態
- 用戶正在編輯教室名稱
- 刪除確認對話框顯示時
- 正在執行其他操作時

這確保了自動刷新功能在後台靜默工作，不會中斷用戶的正常操作流程。