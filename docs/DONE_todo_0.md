# 📋 ClassSync 系統 TODO 清單

## 1. 資料庫與後端

- [ ] 連結資料庫（PostgreSQL + Prisma）。
- [ ] 教室庫改為輸入 **字串**（`name`），不再使用 Place ID。
- [ ] 支援 **新增基地** 與 **新增教室**：

  - 單教室模式：只需輸入基地字串，不顯示子教室。
  - 多教室模式：支援子教室清單。

- [ ] 課程庫資料表設計：

  - 欄位：名稱、連結（可多個，第一個與名稱對齊，其餘往下延伸）、建立時間、更新時間。
  - 提供編輯與刪除 API。

---

## 2. 前端介面

- [ ] **「轉轉轉」特效**不要顯示在「預覽」按鈕上。
- [ ] **課程庫列表化顯示**：

  - 左：課程名稱。
  - 中：第一個連結與名稱對齊，往下延伸。
  - 右：編輯、刪除按鈕。

- [ ] **教室庫顯示**：

  - 只顯示字串名稱（如「弘道基地」「吉林基地」「線上」「其他」「空白」）。

- [ ] **日期與週切換 UI**：

  - `<日期>` 移到畫面正中間。
  - 「本週」按鈕放在日期下方，右邊新增「下週」按鈕。
  - 下週定義為「絕對下週」而不是「相對下週」。

---

## 3. 行動版優化

- [ ] 手機版畫面一次只顯示「一天」。

  - 上方顯示：節次、時間、星期/日期。
  - 下方提供：一天的課程下拉選單。

- [ ] 在下拉選單區塊下方，額外顯示「週一到週五課程總覽」。

  - 只讀（不可編輯）。
  - 僅顯示摘要，節省左右空間。

---

## 4. Google Calendar 整合

- [ ] 登錄 Google Calendar 時，不再自動輸入地點欄位（改為空值或保留字串）。
- [ ] 課程連結支援「名稱 + 連結」：

  - 課程庫顯示：**名稱 連結**。
  - Calendar 顯示：`- 名稱: 連結`。

- [ ] 提供一個按鈕，點擊後在新分頁開啟課表 Google Sheet：
      👉 [課表連結](https://docs.google.com/spreadsheets/d/1scxvMRoDHDc_ubV6fWd0rOcHpFzwMESrBmOtoHiezPc/edit?gid=0#gid=0)。

---

## 5. Google Calendar API 功能

- [ ] 使用 `events.insert()` 建立活動，必填參數：

  - `calendarId`
  - `start.dateTime` / `end.dateTime`

- [ ] 可選參數：

  - `summary`（課程名稱）
  - `description`（說明與連結）
  - `location`（如需則為字串，不使用 Place ID）
  - `attendees`（參與者 email，可設定 `sendUpdates`）
  - `id`（事件 ID，避免重複）

- [ ] 允許新增附件（Google 文件、試算表、簡報等）。
- [ ] 支援建立 Google Meet 視訊會議：

  - `conferenceData.createRequest`
  - `conferenceDataVersion: 1`

- [ ] 支援將會議資料（conferenceData）複製到多個活動。
