import { z } from "zod";

// 日期資料格式 - 每日上午/下午地點
export const DayScheduleSchema = z.object({
  am: z.string().min(1, "上午地點不能為空"),
  pm: z.string().min(1, "下午地點不能為空"),
});

export type DaySchedule = z.infer<typeof DayScheduleSchema>;

// 完整的週曆 Payload 格式
export const PayloadSchema = z.object({
  // 基本識別資訊
  id: z.string().min(3, "ID 至少需要3個字元"),                    // "email@tschool.tp.edu.tw.39"
  week: z.number().int().positive("週次必須為正整數"),             // 週次
  semester: z.string().min(1, "學期不能為空"),                    // "114-1"
  uid: z.string().min(1, "使用者 UID 不能為空"),                  // 使用者 UID
  name: z.string().min(1, "使用者姓名不能為空"),                  // 使用者姓名
  email: z.string().email("請提供有效的 email 地址"),             // 學校 email

  // 時間資訊
  deadline: z.string().min(1, "截止時間不能為空"),                 // "2025-09-18 16:59:59"
  begin: z.string().min(1, "開始時間不能為空"),                   // "2025-09-15 00:00:00"
  timestamp: z.number().optional(),                              // 時間戳

  // 紀錄
  logs: z.array(z.string()).optional(),                          // 操作紀錄
}).catchall(DayScheduleSchema);

export type TschoolPayload = z.infer<typeof PayloadSchema>;

// API 請求參數
export const PayloadRequestSchema = z.object({
  week: z.number().int().positive().optional(),
  weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必須為 YYYY-MM-DD").optional(),
  userEmail: z.string().email("請提供有效的 email 地址").optional(),
});

export type PayloadRequest = z.infer<typeof PayloadRequestSchema>;

// 使用者資訊
export const UserInfoSchema = z.object({
  uid: z.string().min(1, "UID 不能為空"),
  name: z.string().min(1, "姓名不能為空"),
  email: z.string().email("請提供有效的 email 地址"),
  customSchedule: z.record(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    DayScheduleSchema
  ).optional(), // 自訂行程，日期為鍵
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

// 錯誤回應格式
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  timestamp: z.number().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// API 回應格式
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: PayloadSchema,
  timestamp: z.number(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

// 地點常數
export const ALLOWED_LOCATIONS = [
  "弘道基地",
  "吉林基地",
  "在家中"
] as const;

export type AllowedLocation = typeof ALLOWED_LOCATIONS[number];

// 自訂地點格式驗證
export const CustomLocationSchema = z.string().refine(
  (val) => val.startsWith("其他地點:") && val.slice(5).trim().length > 0,
  { message: "自訂地點格式必須為 '其他地點:地點名稱'" }
);

// 地點驗證 schema
export const LocationSchema = z.union([
  z.enum(ALLOWED_LOCATIONS),
  CustomLocationSchema
]);

export type Location = z.infer<typeof LocationSchema>;

// 學期相關型別定義
export const SemesterSchema = z.string().regex(
  /^\d{3}-[12]$/,
  { message: "學期格式必須為 'YYY-N'，例如 '114-1' 或 '113-2'" }
);

export type Semester = z.infer<typeof SemesterSchema>;

export const AcademicYearSchema = z.object({
  academicYear: z.number().int().min(100).max(200), // 民國年 100-200
  semesterNumber: z.union([z.literal(1), z.literal(2)]), // 1=第一學期, 2=第二學期
  startDate: z.date(),
  endDate: z.date(),
});

export type AcademicYear = z.infer<typeof AcademicYearSchema>;

// 學期計算參數
export interface SemesterCalculationParams {
  date?: Date;
  forceCurrentYear?: boolean; // 強制使用當前年度
}

export interface WeekCalculationParams {
  date?: Date;
  semester?: string;
  semesterStartDate?: Date;
}

// 預設設定
export const DEFAULT_SETTINGS = {
  semester: "114-1", // 將會被動態計算取代
  defaultSchedule: {
    am: "弘道基地" as AllowedLocation,
    pm: "弘道基地" as AllowedLocation
  },
  weekdaysOnly: true, // 只產生週一到週五
  timezone: "Asia/Taipei",
  // 學期設定
  firstSemesterStart: { month: 8, day: 1 }, // 8月1日
  firstSemesterEnd: { month: 1, day: 31 }, // 1月31日 (翌年)
  secondSemesterStart: { month: 2, day: 1 }, // 2月1日
  secondSemesterEnd: { month: 7, day: 31 }, // 7月31日
} as const;

// 工具函數型別
export interface PayloadGenerationParams {
  week: number;
  weekStartISO: string;
  userInfo: UserInfo;
  schedule?: Record<string, DaySchedule>;
}