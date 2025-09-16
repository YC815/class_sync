import { NextRequest, NextResponse } from "next/server";
import {
  PayloadSchema,
  PayloadRequestSchema,
  UserInfoSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  ALLOWED_LOCATIONS,
  DEFAULT_SETTINGS,
  type TschoolPayload,
  type UserInfo,
  type DaySchedule,
  type PayloadGenerationParams,
  type Semester
} from "./types";
import {
  getSemester,
  getSemesterInfo,
  calculateAcademicWeek,
  getNextMondayISO,
  getCurrentSemesterWeek
} from "./semester-utils";

// 安全設定 - 從環境變數讀取
const API_SECRET = process.env.TSCHOOL_API_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 日誌函數
function log(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Tschool API] ${message}`, data || '');
}

// 錯誤回應函數
function errorResponse(error: string, status: number = 400, details?: string) {
  const response = {
    error,
    details,
    timestamp: Date.now()
  };

  log(`錯誤: ${error}`, { status, details });

  return NextResponse.json(response, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Cache-Control': 'no-store',
    }
  });
}

// 成功回應函數
function successResponse(data: TschoolPayload) {
  const response = {
    success: true as const,
    data,
    timestamp: Date.now()
  };

  const nextResponse = NextResponse.json(data, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Cache-Control': 'no-store',
    }
  });

  return nextResponse;
}

// 正規化地點名稱
function normalizeLocation(location: string): string {
  // 檢查是否為允許的地點
  if (ALLOWED_LOCATIONS.includes(location as any)) {
    return location;
  }

  // 檢查自訂地點格式: "其他地點:地點名稱"
  if (location.startsWith("其他地點:")) {
    const customPlace = location.slice(5).trim();
    if (customPlace.length > 0) {
      return location;
    }
  }

  throw new Error(`無效的地點: ${location}`);
}

// 計算週次 (根據學期開始日期) - 整合新的學期邏輯
function calculateWeekNumber(date: Date, semester?: Semester): number {
  try {
    // 使用新的學期工具函數計算週次
    const targetSemester = semester || getSemester(date);
    const weekNumber = calculateAcademicWeek(date, targetSemester);

    log(`計算週次: 日期=${date.toISOString().split('T')[0]}, 學期=${targetSemester}, 週次=${weekNumber}`);
    return weekNumber;
  } catch (error: any) {
    // 如果新邏輯失敗，使用舊的預設邏輯作為備用
    log(`學期週次計算失敗，使用備用方案: ${error?.message || '未知錯誤'}`);

    const defaultSemesterStart = new Date('2024-09-01');
    const diffTime = Math.abs(date.getTime() - defaultSemesterStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil(diffDays / 7);

    log(`備用週次計算: 日期=${date.toISOString().split('T')[0]}, 週次=${weekNumber}`);
    return weekNumber;
  }
}

// 取得下週一的日期 - 使用新的學期工具函數
function getNextMondayOfWeek(referenceDate: Date = new Date()): string {
  try {
    // 使用新的學期工具函數
    return getNextMondayISO(referenceDate);
  } catch (error: any) {
    // 備用邏輯
    log(`下週一計算失敗，使用備用方案: ${error?.message || '未知錯誤'}`);

    const date = new Date(referenceDate);
    const dayOfWeek = date.getDay();
    const daysToNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    date.setDate(date.getDate() + daysToNextMonday);

    return date.toISOString().split('T')[0];
  }
}

// 從資料庫取得使用者資訊和基地資料
async function getUserInfo(email?: string): Promise<UserInfo> {
  log('取得使用者資訊', { email });

  // TODO: 實際實作時需要查詢資料庫獲取真實用戶資料
  // 這裡暫時使用模擬資料，但結構已準備好整合資料庫
  const mockUser: UserInfo = {
    uid: email ? `uid-${email.replace('@', '-').replace('.', '-')}` : "default-uid-12345",
    name: email ? email.split('@')[0] : "測試使用者",
    email: email || "test@tschool.tp.edu.tw",
    // 將從資料庫查詢實際的自訂行程
    customSchedule: undefined
  };

  // 驗證回傳的資料
  const validatedUser = UserInfoSchema.parse(mockUser);
  log('使用者資訊已驗證', { uid: validatedUser.uid, name: validatedUser.name });

  return validatedUser;
}

// 從資料庫取得使用者指定週次的課程基地資料
async function getUserScheduleFromDB(userEmail: string, weekStartISO: string): Promise<Record<string, DaySchedule> | undefined> {
  log('查詢使用者課程基地資料', { userEmail, weekStartISO });

  try {
    // TODO: 實際實作資料庫查詢
    // 這裡需要實作以下邏輯：
    // 1. 根據 email 查詢 User.id
    // 2. 根據 weekStart 查詢 Event 資料
    // 3. 轉換成 DaySchedule 格式

    // 模擬資料庫查詢結果
    // 實際應該查詢 Event 表，取得該週每天的課程安排
    const mockScheduleFromDB: Record<string, DaySchedule> = {
      // 示範：從 Event 表查到的實際課程基地資料
      "2024-09-23": { am: "弘道基地", pm: "吉林基地" },  // 週一
      "2024-09-24": { am: "吉林基地", pm: "弘道基地" },  // 週二
      "2024-09-25": { am: "其他地點:圖書館", pm: "弘道基地" }, // 週三
      "2024-09-26": { am: "弘道基地", pm: "弘道基地" },  // 週四
      "2024-09-27": { am: "吉林基地", pm: "其他地點:實習場所" } // 週五
    };

    log('成功取得使用者課程基地資料', { recordCount: Object.keys(mockScheduleFromDB).length });
    return mockScheduleFromDB;

  } catch (error: any) {
    log('查詢使用者課程基地資料失敗', { error: error.message });
    return undefined;
  }
}

// 產生週曆資料 - 整合動態學期計算
function generateWeeklyPayload(params: PayloadGenerationParams): TschoolPayload {
  const { week, weekStartISO, userInfo, schedule } = params;

  log('產生週曆資料', { week, weekStartISO, userEmail: userInfo.email });

  // 動態計算學期
  const weekStartDate = new Date(weekStartISO + 'T00:00:00.000Z');
  const dynamicSemester = getSemester(weekStartDate);

  log('動態學期計算', { weekStartISO, dynamicSemester });

  // 基礎 payload - 使用動態學期
  const basePayload: Record<string, any> = {
    id: `${userInfo.email}.${week}`,
    week,
    semester: dynamicSemester, // 使用動態計算的學期
    uid: userInfo.uid,
    name: userInfo.name,
    email: userInfo.email,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19),
    begin: new Date(weekStartISO + 'T00:00:00.000Z')
      .toISOString().replace('T', ' ').substring(0, 19),
    timestamp: Date.now(),
    logs: [
      new Date().toISOString().replace('T', ' ').substring(0, 19)
    ]
  };

  // 產生一週的資料 (週一到週五)
  const startDate = new Date(weekStartISO + 'T00:00:00.000Z');

  for (let i = 0; i < 5; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];

    // 優先使用自訂行程，否則使用預設行程
    let daySchedule: DaySchedule;

    if (schedule && schedule[dateStr]) {
      daySchedule = schedule[dateStr];
    } else if (userInfo.customSchedule && userInfo.customSchedule[dateStr]) {
      daySchedule = userInfo.customSchedule[dateStr];
    } else {
      daySchedule = DEFAULT_SETTINGS.defaultSchedule;
    }

    // 正規化地點名稱
    basePayload[dateStr] = {
      am: normalizeLocation(daySchedule.am),
      pm: normalizeLocation(daySchedule.pm)
    };

    log(`設定 ${dateStr}`, basePayload[dateStr]);
  }

  // 驗證最終的 payload
  const validatedPayload = PayloadSchema.parse(basePayload);
  log('週曆資料已生成並驗證');

  return validatedPayload;
}

// 主要 GET 處理函數
export async function GET(request: NextRequest) {
  try {
    log('收到 GET 請求');

    // 1. 驗證 API Secret
    const authHeader = request.headers.get('authorization');

    if (NODE_ENV === 'production') {
      if (!API_SECRET) {
        return errorResponse('伺服器配置錯誤', 500, '缺少 API_SECRET 環境變數');
      }

      if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
        return errorResponse('未授權', 401, '無效的 API 密鑰');
      }
    } else {
      // 開發環境下的警告
      if (!authHeader) {
        log('警告: 開發環境下未提供授權標頭');
      }
    }

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);

    const rawParams = {
      week: searchParams.get('week') ? Number(searchParams.get('week')) : undefined,
      weekStartISO: searchParams.get('weekStartISO') || undefined,
      userEmail: searchParams.get('userEmail') || undefined,
    };

    log('原始參數', rawParams);

    // 驗證參數格式
    const requestParams = PayloadRequestSchema.parse(rawParams);

    // 3. 計算預設值 - 使用動態學期邏輯
    const now = new Date();

    // 如果沒有提供週次，使用新的學期週次計算
    let week: number;
    if (requestParams.week) {
      week = requestParams.week;
    } else {
      try {
        const currentSemesterWeek = getCurrentSemesterWeek(now);
        week = currentSemesterWeek.week;
        log('使用動態週次計算', { week, semester: currentSemesterWeek.semester });
      } catch (error: any) {
        week = calculateWeekNumber(now);
        log('週次計算備用方案', { week, error: error?.message });
      }
    }

    const weekStartISO = requestParams.weekStartISO || getNextMondayOfWeek(now);

    log('處理參數', { week, weekStartISO, userEmail: requestParams.userEmail });

    // 4. 取得使用者資訊
    const userInfo = await getUserInfo(requestParams.userEmail);

    // 5. 取得使用者的實際課程基地資料
    const userScheduleFromDB = await getUserScheduleFromDB(userInfo.email, weekStartISO);

    log('使用者課程基地資料', {
      hasSchedule: !!userScheduleFromDB,
      scheduleKeys: userScheduleFromDB ? Object.keys(userScheduleFromDB) : []
    });

    // 6. 產生 payload
    const payload = generateWeeklyPayload({
      week,
      weekStartISO,
      userInfo,
      schedule: userScheduleFromDB, // 使用從資料庫查詢的實際課程基地資料
    });

    log('成功產生 payload', {
      payloadId: payload.id,
      dateKeys: Object.keys(payload).filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/))
    });

    // 6. 回傳成功結果
    return successResponse(payload);

  } catch (error: any) {
    log('API 錯誤', {
      error: error.message,
      name: error.name,
      stack: NODE_ENV === 'development' ? error.stack : undefined
    });

    // Zod 驗證錯誤
    if (error.name === 'ZodError') {
      const details = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return errorResponse('參數驗證失敗', 400, details);
    }

    // 其他錯誤
    return errorResponse(
      error.message || '內部伺服器錯誤',
      500,
      NODE_ENV === 'development' ? error.stack : undefined
    );
  }
}

// CORS 預檢請求處理
export async function OPTIONS(request: NextRequest) {
  log('收到 OPTIONS 請求');

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Max-Age': '3600',
    },
  });
}