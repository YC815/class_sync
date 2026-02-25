# ClassSync 全面技術審查

> 審查日期：2026-02-25

---

## 修改記錄

### 2026-02-25 已完成的修復

**P0（直接 Bug）**
- ✅ ~~#1~~ **Tailwind 顏色類檢查** - 經查證 `bg-green-25`/`bg-yellow-25` 不存在於當前版本，實際使用正確的 `bg-green-50`/`bg-yellow-50`
- ✅ **#2** `fetcher.ts` 錯誤訊息增強  
  **Commit:** `dae2bb7` - chore: enhance error handling and cleanup production logs
  - 解析 JSON 錯誤響應，提供詳細錯誤訊息
  - 支援 response text 和 status text fallback
  - 截斷過長錯誤訊息（200 字元限制）

**P1（架構安全）**
- ✅ **#3** `writeScheduleAsEvents` 保留現有 `calendarEventId`  
  **Commit:** `0742caf` - fix(schedule-writer): fix calendarEventId matching after merge
  - 使用「降維拆解」策略：將 period 範圍展開為獨立 keys
  - Key 格式：`${weekday}-${period}-${courseName}`（不依賴 periodEnd）
  - 查詢時遍歷合併範圍，繼承第一個找到的 `calendarEventId`
  - 解決合併後 period 範圍改變導致的匹配失敗問題

- ✅ **#4** Token 刷新邏輯統一與持久化  
  **Commit:** `7001757` - refactor(auth): unify token refresh logic and ensure DB persistence
  - **Single Source of Truth**: 移除 JWT callback 的 refresh 邏輯，統一由 `ensureGoogleAccess()` 處理
  - 確保 refreshed token（含 `refresh_token`）寫入 Prisma DB
  - 補齊遺漏的 API routes：`/weeks/[weekStart]` 和 `/weeks/[weekStart]/sync-deleted`
  - 避免 race condition，提升架構穩定性

- ✅ **#5** `baseId`/`roomId` null 問題修復  
  **Commit:** `36d4eda` - fix: persist baseId and roomId in Event records with strict validation
  - 在 `writeScheduleAsEvents` 中加入 base/room ID lookup
  - 建立 baseName→baseId 和 roomName→roomId 對照表
  - 對無效的 base/room 名稱拋出明確錯誤

- ✅ ~~#5~~ **auth.ts signIn callback** - 經查證已實作區分處理（見 commit `36d4eda`）

**P2（效能提升）**
- ✅ **#8** SWR global mutate 修復  
  **Commit:** `42a0185` - fix: use SWR global mutate to refresh all week caches after sync
  - 同步成功後使用 global mutate 失效所有 `/api/weeks/*` 快取
  - 確保所有週次的 `isSynced` 狀態正確反映

**P3（程式碼品質）**
- ✅ **#9** `dashboard/page.tsx` 拆分為自定義 hooks  
  **Commit:** `130c268` - refactor(dashboard): extract business logic into custom hooks
  - 建立 `useScheduleState.ts` (256行)、`useSyncOperations.ts` (291行)、`useRayIntegration.ts` (81行)
  - `page.tsx` 從 1246 行縮減至 801 行 (-35%)
  - 解決 `loadWeekScheduleRef` stale closure 反模式

- ✅ **#10** 移除 production console.log  
  **Commit:** `dae2bb7` - chore: enhance error handling and cleanup production logs
  - `schedule-utils.ts`: `getSemester()`, `calculateAcademicWeek()`, `getWeekStart()`
  - `google-calendar.ts`: `listEvents()`, `createEvent()`, `updateEvent()`, `deleteEvent()`
  - 使用 `process.env.NODE_ENV !== 'production'` 條件判斷
  - 減少生產環境噪音，避免敏感資訊洩漏

**UI/UX 改進**
- ✅ **行動版觸控目標優化**  
  **Commit:** `c5e86fd` - fix: responsive dual-layout for mobile touch targets (44px minimum)
  - 桌面版：保留現有表格佈局（手機版隱藏）
  - 手機版：新增卡片式日期檢視，觸控目標 44px+
  - 所有選擇器使用 h-11 (44px) 最小高度

---

## 待處理清單

### P0（直接 Bug）- 已全部完成 ✅

### P1（架構安全）- 已全部完成 ✅

### P2（效能提升）- 待修復
1. ~~#7~~ ScheduleTable 中 IIFE 提取為函數 + `getWeekdayDates` 加 `useMemo`
2. ~~#8~~ 每次切換週不再自動觸發 `sync-deleted`（避免多餘的 Google API 調用）
3. ✅ ~~#9~~ `window.location.reload()` 改為 SWR mutate - **已完成**

### P3（程式碼品質）- 待修復
4. ~~#10~~ `dashboard/page.tsx` 拆分為自定義 hooks - **已完成**
5. ~~#11~~ 移除 production console.log - **已完成**
6. **#12** `localStorage` 加入版本號 - 待修復

---

## 一、後端：邏輯流程 & 資料流

### Code Review

# Code review
Found 5 urgent issues need to be fixed:

## 1 Token 刷新邏輯重複且刷新後無法持久化

FilePath: `src/lib/auth.ts` line 90-138 & `src/lib/google-auth.ts` line 21-81

兩處都有 token 刷新邏輯。`auth.ts` 的 JWT callback 刷新後更新 JWT，但 `ensureGoogleAccess()` 刷新後只返回新 access token，並不回寫到 JWT/Session，導致**每一次** API 呼叫若 token 接近到期，都會重複呼叫 Google token endpoint。

```typescript
// google-auth.ts line 72
return refreshedTokens.access_token  // ← 新 token 不持久化，下次請求又刷新
```

### Suggested fix
在 `ensureGoogleAccess()` 返回值加入 `newExpiresAt`，呼叫端若取得新 token，透過 `prisma.account.update()` 回寫 `access_token` / `expires_at`；或將刷新邏輯統一到 `auth.ts` JWT callback，`ensureGoogleAccess()` 只做驗證。

---

## 2 `writeScheduleAsEvents` 始終將 `calendarEventId` 設為 null

FilePath: `src/lib/schedule-writer.ts` line 160

```typescript
calendarEventId: null, // 新建事件，尚未同步
```

每次保存課表都刪除並重建 Event 記錄，`calendarEventId` 被清空。這代表即使課程內容沒有改變，下次同步時所有事件都被視為「尚未同步」，造成不必要的 Google Calendar 建立/刪除操作，並破壞 `isSynced` 的語意。

### Suggested fix
在 delete+create 事務前，先查詢現有 `Event` 的 `calendarEventId`，以 `(weekday, periodStart, periodEnd, courseName)` 為 key 建立 Map，在 `eventsToCreate` 中保留匹配的 `calendarEventId`。

---

## 3 signIn callback 靜默吞掉 user 建立失敗

FilePath: `src/lib/auth.ts` line 65-69

```typescript
} catch (error) {
  console.error('Error managing user:', error)
  // Still allow sign in even if user creation fails
}
return true
```

若 DB 連線問題導致 user 建立失敗，用戶仍能登入，但後續所有 API 都會因為找不到 `userId` 的 User 記錄而引發 FK constraint 錯誤或靜默失敗（基地/課程無法建立）。

### Suggested fix
區分「user 已存在但更新失敗」（可忽略）vs「user 不存在且建立失敗」（應 return false 阻止登入）。

---

## 4 fetcher 未處理非 2xx HTTP 回應

FilePath: `src/lib/fetcher.ts` line 2

```typescript
export const fetcher = (url: string) => fetch(url).then(r => r.json())
```

SWR 會將 401/500 的 JSON 響應體（如 `{ error: '...' }`) 當作成功數據存入 `courses`/`bases`，造成 UI 顯示錯誤對象，且 SWR 的 `error` 狀態不會被觸發。

### Suggested fix
```typescript
export const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
```

---

## 5 `baseId` / `roomId` 始終為 null，FK 完整性破壞

FilePath: `src/lib/schedule-writer.ts` line 46, 153

```typescript
baseId: null, // 暫不處理 baseId/roomId 的 lookup
roomId: null,
```

`Event` 表有 `baseId`/`roomId` FK 欄位但始終為 null，只靠 `baseName`/`roomName` 字串。若用戶更名基地或刪除教室，所有歷史 Event 的位置資訊會靜默失效。

### Suggested fix
在 `scheduleToEvents()` 中加入 base/room 的 `findFirst({ where: { userId, name } })` 查詢，或在 `writeScheduleAsEvents()` 入參中直接傳入 `baseId`/`roomId`（從客戶端 payload 攜帶）。

---

Found 4 suggestions for improvement:

## 1 大量 production console.log 應移除或改為條件輸出

FilePath: `src/lib/schedule-utils.ts` line 27, 56; `src/lib/google-calendar.ts` line 79-101

`getSemester()`、`calculateAcademicWeek()`、`getWeekStart()` 每次呼叫都有 console.log；`GoogleCalendarService.listEvents()` 打印所有 event 詳情（含 description snippet）。在生產環境中有效能損耗，也可能洩漏敏感資訊。

### Suggested fix
改用環境判斷：`if (process.env.NODE_ENV !== 'production') console.log(...)` 或使用 debug library。

---

## 2 每次切換週次都呼叫 `sync-deleted` API（帶 Google Calendar 請求）

FilePath: `src/app/dashboard/page.tsx` line 156-165

```typescript
const promises = [fetch(`/api/weeks/${weekStartStr}`)]
if (!skipSyncDeleted) {
  promises.push(fetch(`/api/weeks/${weekStartStr}/sync-deleted`, { method: 'POST' }))
}
```

`sync-deleted` 需要向 Google Calendar 列出該週所有事件，每次切換週次都觸發一次 Google API 調用，增加延遲和配額消耗。

### Suggested fix
改為只在明確需要時（如：用戶手動觸發「同步」時）呼叫 `sync-deleted`；或改為 debounce + background job 模式。

---

## 3 強制同步的逐週 for 迴圈中錯誤處理應更謹慎

FilePath: `src/app/dashboard/page.tsx` line 527-558

```typescript
for (let i = 0; i < weeks.length; i++) {
  ...
  if (!res.ok) {
    setForceSyncStep('error')
    setForceSyncMessage(`第 ${i + 1} 週（${weekStart}）失敗：...`)
    return  // ← 立刻中止，不繼續後續週
  }
}
```

任何一週失敗就停止整個流程，不提供跳過失敗週的選項，也不顯示已完成的進度。

### Suggested fix
累積 errors 而非立即 return，最後在 success 訊息中顯示「X 週成功，Y 週失敗（列出失敗的 weekStart）」。

---

## 4 `schedule-writer.ts` 用 `Array.find()` 查匹配原始事件，邏輯不完整

FilePath: `src/lib/schedule-writer.ts` line 136-143

```typescript
const originalEvent = rawEvents.find(
  e => e.weekday === mergedEvent.weekday &&
    e.periodStart >= mergedEvent.periodStart &&
    e.periodStart <= mergedEvent.periodEnd &&
    e.courseName === mergedEvent.courseName
)
```

合併後的事件只取**第一個**匹配的 raw event 的 baseName/roomName，若同課程不同節次有不同教室（理論上不應發生但可能發生），會靜默丟棄後者的位置資訊。

### Suggested fix
加一個 assertion 驗證合併範圍內所有 raw events 的 baseName/roomName 一致，若不一致 throw Error 提前失敗而非靜默。

---

---

## 二、Next.js 架構

### 架構評估

| 面向 | 現況 | 評分 |
|------|------|------|
| App Router 使用 | 正確使用 RSC + Client 分離 | ✅ |
| Server Components | `dashboard/page.tsx` 是 `'use client'`，喪失 RSC 優勢 | ⚠️ |
| 資料獲取 | 全部用 SWR 客戶端獲取，無 Server-side fetch | ⚠️ |
| 路由組織 | API routes 結構清晰，符合 Next.js 慣例 | ✅ |
| 靜態/動態渲染 | 儀表板為純動態，合理 | ✅ |

**關鍵架構問題：`dashboard/page.tsx` 承擔了 1237 行邏輯**

這個頁面包含了：週次狀態、課表狀態、同步狀態、強制同步、RAY 抓取、測試重置、多個 dialog 狀態... 共 20+ 個 `useState`。這是違反 Single Responsibility 的紅旗。

**建議拆分：**
```
dashboard/
├── page.tsx              (≤100行，組合各子組件)
├── useScheduleState.ts   (schedule + week 邏輯)
├── useSyncOperations.ts  (sync/forceSync/recover)
├── useRayIntegration.ts  (RAY 課表抓取)
```

**`loadWeekScheduleRef` 反模式：**
```typescript
// 每次 render 直接賦值 ref，然後用 useCallback 包裝
loadWeekScheduleRef.current = async (week, ...) => { ... }
const loadWeekSchedule = useCallback(async (...) => {
  return loadWeekScheduleRef.current?.(...)
}, [])
```
這是為了解決 stale closure 的變通方案，但閉包中依賴的 `pendingChanges`、`isPreventingReload`、`currentWeek` 等應改為用 `useRef` 存儲，或使用 `useReducer` 統一管理。

---

## 三、前端效能

### 效能問題清單

**立即影響：**

1. **IIFE 在 JSX render 中** — `ScheduleTable.tsx` line 402-410, 428-448
   ```tsx
   value={(() => {
     if (cell?.isContinuation) return 'continuation'
     ...
   })()}
   ```
   每次渲染都創建新匿名函數，無法被 React 優化。應提取為 `getCellValue(cell)` 外部函數。

2. **`getWeekdayDates()` 無 memoization** — `ScheduleTable.tsx` line 57-65
   只在 `currentWeek` 改變時需要重算，但每次渲染都重新執行 7 次 Date 計算。應改為 `useMemo`。

3. **`getCellContent()` 每次都 `courses.find()`** — `ScheduleTable.tsx` line 96
   在 render 中對每個 cell 都執行線性搜尋。課程數量不大時問題不嚴重，但應預先建立 `Map<id, Course>`。

4. **`checkHalfDayBaseConflict` + `getHalfDayBaseDisplay` 重複遍歷** — `ScheduleTable.tsx` line 266-298
   兩個函數幾乎相同邏輯，渲染時每個「天×半天」各調用兩次，共 14 次重複遍歷。

**中等影響：**

5. **同步成功後手動更新 isSynced 不完整** — `dashboard/page.tsx` line 420-436
   `sync-all` 同步的是**所有週**的未同步事件，但客戶端只更新了**當前週**的 `isSynced`。其他週的 isSynced 狀態不準確，需等下次載入。

6. **`handleTestReset` 使用 `window.location.reload()`** — `dashboard/page.tsx` line 603
   粗暴全頁重載，應改為 `mutateCourses()` + `mutateBases()` + `loadWeekSchedule(currentWeek)`。

7. **localStorage 無版本控制** — `src/lib/local-schedule.ts`
   ```typescript
   localStorage.setItem(`schedule_${weekStart}`, JSON.stringify(schedule))
   ```
   ScheduleCell schema 若改變（新增/刪除欄位），舊緩存導致靜默的 data corruption。

---

## 四、前端視覺設計

**界面描述：** 週課表管理儀表板，目標用戶為教師（台北市數位實驗高中），使用 shadcn/ui + Tailwind CSS 4。

### UI Design Review

| 維度 | 評分 | 狀態 |
|------|------|------|
| Visual Hierarchy | 6/10 | ⚠️ |
| Typography | 7/10 | ✅ |
| Color Palette | 7/10 | ⚠️ |
| Spacing & White Space | 7/10 | ✅ |
| Visual Consistency | 5/10 | ⚠️ |
| Component Design | 7/10 | ✅ |
| Layout & Grid | 7/10 | ✅ |
| Branding & Personality | 6/10 | ⚠️ |
| Modern Standards | 8/10 | ✅ |
| Imagery & Graphics | 6/10 | ⚠️ |

**整體評分：66/100（Customized Framework 等級）**

---

#### 主要視覺問題

**問題 1：不存在的 Tailwind 顏色類**
FilePath: `src/components/schedule/ScheduleTable.tsx` line 415-417

```tsx
className={`... ${
  cell?.isSynced
    ? 'border-green-300 bg-green-25'   // ← bg-green-25 不存在！
    : cell
      ? 'border-yellow-300 bg-yellow-25 ...' // ← bg-yellow-25 不存在！
```

Tailwind 的最淡色是 `50`，不是 `25`。這些類名靜默失效，格子沒有任何背景色，導致狀態視覺回饋完全消失。應改為 `bg-green-50` / `bg-yellow-50`。

**問題 2：週末欄位背景色不一致**
FilePath: `src/components/schedule/ScheduleTable.tsx` line 332, 362, 389, 555

- 上午基地整理行週末：`bg-stone-300` （石灰色）
- PERIOD 行週末格子：`bg-gray-50` （淺灰色）
- 下午基地整理行週末：`bg-stone-300` （石灰色）

同一欄的顏色在不同行之間不一致，視覺上有割裂感。應統一為一個顏色（建議 `bg-slate-100`）。

**問題 3：課表格子過於密集**

每個有課程的格子（80px 高）塞了三個 `Select` 下拉選單（課程、基地、教室），每個僅 24px 高，文字 `text-xs`。在觸控裝置上 24px 遠低於 44px 的最低觸控目標標準，操作困難。

**問題 4：浮動同步按鈕遮蓋第 8 節課**
FilePath: `src/components/schedule/FloatingSyncButton.tsx` line 177

```tsx
<div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pb-safe">
```

`bottom-6`（24px）的浮動按鈕高度約 48px，`pb-safe` 加 safe area 後，可能遮蓋到課表最後一行（第 8 節）的教室選擇器，特別是在 13" 筆電上。

**問題 5：狀態圖例的虛線模擬**
FilePath: `src/components/schedule/ScheduleTable.tsx` line 311-313

```tsx
<div className="w-4 h-4 bg-yellow-100 border-l-4 border-yellow-400 rounded-sm border-dashed border-r border-t border-b">
```

試圖用多個 border classes 模擬「左邊實線+其他虛線」效果，但 `border-dashed` 會覆蓋所有邊框樣式，實際上四邊都變虛線。應改用 CSS Grid 或 SVG 圖示，或直接用一個帶顏色的色點代替。

#### 視覺優點

- ✅ FloatingSyncButton 行動版展開動畫流暢，backdrop-blur pill 標籤設計精緻
- ✅ 基地衝突提示（紅色警告）視覺清晰，有邊框+背景+文字三重提示
- ✅ shadcn/ui 組件系統一致，Dialog/Card/Button 風格統一
- ✅ 載入骨架屏（Skeleton）使用恰當，不會出現空白頁面
- ✅ 同步成功/失敗的對話框使用正確的語意顏色（綠/紅）

---

## 優先修復清單

### P0（直接 Bug）
1. `bg-green-25` / `bg-yellow-25` → 改為 `bg-green-50` / `bg-yellow-50`（狀態顏色失效）
2. `fetcher.ts` 加入非 2xx 錯誤 throw（SWR 錯誤不被捕獲）

### P1（架構安全）
3. `writeScheduleAsEvents` 保留現有 `calendarEventId`（每次保存破壞同步狀態）
4. `google-auth.ts` 刷新後的新 token 持久化回 DB
5. `auth.ts` signIn callback 區分可忽略 vs 阻止登入的失敗

### P2（效能提升）
6. ScheduleTable 中 IIFE 提取為函數 + `getWeekdayDates` 加 `useMemo`
7. 每次切換週不再自動觸發 `sync-deleted`（避免多餘的 Google API 調用）
8. `window.location.reload()` 改為 SWR mutate

### P3（程式碼品質）
9. `dashboard/page.tsx` 拆分為自定義 hooks（`useScheduleState`, `useSyncOperations`）
10. 移除 production console.log（特別是 google-calendar.ts 中的事件詳情打印）
11. `localStorage` 加入版本號
12. `baseId`/`roomId` null 問題長期修復
