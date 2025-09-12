# 排課系統 × Google Calendar 同步

一個基於 Next.js 的週課表管理系統，支援與 Google Calendar 同步功能。

## 功能特色

- ✅ **週課表管理**: 直觀的表格介面，支援週次導航
- ✅ **課程庫管理**: 新增、編輯、刪除課程，設定預設連結  
- ✅ **Google OAuth 登入**: 安全的 Google 帳號登入
- ✅ **Google Calendar 同步**: 將課表同步至 Google Calendar
- ✅ **預覽功能**: 同步前預覽變更內容
- ✅ **響應式設計**: 支援桌面與行動裝置
- ✅ **時間管理**: 自動處理相鄰課程合併與跨午間拆分

## 技術棧

### 前端
- **Next.js 15** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS 4**
- **shadcn/ui** - UI 組件庫
- **NextAuth.js** - 認證系統

### 後端
- **Next.js API Routes**
- **Prisma** - ORM
- **PostgreSQL** - 資料庫
- **Google APIs** - Calendar 整合

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env.local` 並填入必要資訊：

```bash
cp .env.example .env.local
```

編輯 `.env.local`:

```env
# 資料庫連線
DATABASE_URL="postgresql://username:password@localhost:5432/class_sync?schema=public"

# Google OAuth 設定
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_SECRET="your-nextauth-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Google OAuth 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google Calendar API
4. 建立 OAuth 2.0 憑證：
   - 應用程式類型：Web 應用程式
   - 已授權的重新導向 URI：`http://localhost:3000/api/auth/callback/google`
   - 範圍：`openid profile email https://www.googleapis.com/auth/calendar`

### 4. 資料庫設定

```bash
# 產生 Prisma 客戶端
npx prisma generate

# 執行資料庫遷移（需先設定 PostgreSQL）
npx prisma db push
```

### 5. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 檢視應用程式。

## 部署

### Vercel 部署

1. 將專案推送到 GitHub
2. 在 Vercel 匯入專案
3. 設定環境變數
4. 部署完成

### 資料庫選項

- **Supabase**: 免費的 PostgreSQL 託管服務
- **Railway**: 簡單的資料庫託管
- **PlanetScale**: 無伺服器 MySQL (需調整 Prisma schema)

## 專案結構

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── auth/              # 認證頁面
│   ├── layout.tsx         # 根版面
│   └── page.tsx           # 主頁
├── components/            # React 組件
│   ├── auth/              # 認證組件
│   ├── courses/           # 課程管理
│   ├── providers/         # Context 提供者
│   ├── schedule/          # 課表組件
│   └── ui/                # shadcn/ui 組件
├── lib/                   # 工具函數
│   ├── auth.ts            # NextAuth 設定
│   ├── google-calendar.ts # Google Calendar API
│   ├── prisma.ts          # Prisma 客戶端
│   ├── schedule-utils.ts  # 課表工具函數
│   ├── types.ts           # TypeScript 類型
│   └── utils.ts           # 通用工具函數
└── generated/prisma/      # Prisma 產生的客戶端
```

## API 端點

- `GET/POST /api/courses` - 課程 CRUD
- `PATCH /api/courses/[id]` - 更新課程  
- `DELETE /api/courses/[id]` - 刪除課程
- `GET/PATCH /api/weeks` - 週課表管理
- `POST /api/weeks/[weekStart]/preview` - 預覽同步變更
- `POST /api/weeks/[weekStart]/sync` - 同步至 Google Calendar

## 開發指南

### 添加新課程欄位

1. 更新 `prisma/schema.prisma` 中的 `Course` 模型
2. 執行 `npx prisma db push` 更新資料庫
3. 更新 `src/lib/types.ts` 中的 TypeScript 類型
4. 修改相關 UI 組件

### 自定義課表時間

編輯 `src/lib/types.ts` 中的 `PERIOD_TIMES` 常數：

```typescript
export const PERIOD_TIMES = {
  1: '08:25-09:10',
  2: '09:20-10:05', 
  // ... 其他時段
}
```

## 故障排除

### 常見問題

1. **Google Calendar API 錯誤**
   - 檢查 API 金鑰與權限設定
   - 確認重新導向 URI 正確

2. **資料庫連線失敗**
   - 驗證 `DATABASE_URL` 格式
   - 確保 PostgreSQL 服務運行

3. **NextAuth 錯誤**
   - 檢查 `NEXTAUTH_SECRET` 是否設定
   - 確認 `NEXTAUTH_URL` 與當前域名一致
