import {
  SemesterSchema,
  AcademicYearSchema,
  DEFAULT_SETTINGS,
  type Semester,
  type AcademicYear,
  type SemesterCalculationParams,
  type WeekCalculationParams
} from "./types";

/**
 * 根據日期計算民國學年度學期格式 "YYY-N"
 *
 * 學期區間定義：
 * - 第一學期：8月1日 ～ 翌年1月31日 (N = 1)
 * - 第二學期：2月1日 ～ 7月31日 (N = 2)
 *
 * 學年度判斷：
 * - 8-12月：當年國曆年 - 1911
 * - 1-7月：前一年國曆年 - 1911
 *
 * @param date 計算日期，預設為當前日期
 * @param params 可選參數
 * @returns 學期字串，格式為 "YYY-N"
 *
 * @example
 * getSemester(new Date('2025-01-20')) // "113-1"
 * getSemester(new Date('2025-02-15')) // "113-2"
 * getSemester(new Date('2025-09-10')) // "114-1"
 * getSemester(new Date('2026-03-05')) // "114-2"
 */
export function getSemester(
  date: Date = new Date(),
  params: SemesterCalculationParams = {}
): Semester {
  const { forceCurrentYear = false } = params;

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  let academicYear: number;
  let semesterNumber: 1 | 2;

  if (month >= 8) {
    // 8~12月 → 當年度，第一學期
    academicYear = forceCurrentYear ? year - 1911 : year - 1911;
    semesterNumber = 1;
  } else if (month >= 2) {
    // 2~7月 → 前一年度，第二學期
    academicYear = forceCurrentYear ? year - 1911 : (year - 1) - 1911;
    semesterNumber = 2;
  } else {
    // 1月 → 前一年度，第一學期
    academicYear = forceCurrentYear ? year - 1911 : (year - 1) - 1911;
    semesterNumber = 1;
  }

  const semester = `${academicYear}-${semesterNumber}`;

  // 驗證格式
  const validatedSemester = SemesterSchema.parse(semester);

  console.log(`[getSemester] 計算學期: ${date.toISOString().split('T')[0]} → ${validatedSemester}`);

  return validatedSemester;
}

/**
 * 取得學期詳細資訊
 *
 * @param semester 學期字串，格式 "YYY-N"
 * @returns 學期詳細資訊物件
 */
export function getSemesterInfo(semester: Semester): AcademicYear {
  const validatedSemester = SemesterSchema.parse(semester);
  const [academicYearStr, semesterNumStr] = validatedSemester.split('-');

  const academicYear = parseInt(academicYearStr, 10);
  const semesterNumber = parseInt(semesterNumStr, 10) as 1 | 2;

  // 計算實際年份（民國年 → 國曆年）
  const actualYear = academicYear + 1911;

  let startDate: Date;
  let endDate: Date;

  if (semesterNumber === 1) {
    // 第一學期：8月1日 ～ 翌年1月31日
    startDate = new Date(actualYear, 7, 1); // 8月1日 (月份0-based)
    endDate = new Date(actualYear + 1, 0, 31); // 翌年1月31日
  } else {
    // 第二學期：2月1日 ～ 7月31日
    startDate = new Date(actualYear, 1, 1); // 2月1日
    endDate = new Date(actualYear, 6, 31); // 7月31日
  }

  const semesterInfo = {
    academicYear,
    semesterNumber,
    startDate,
    endDate
  };

  // 驗證資料
  const validatedInfo = AcademicYearSchema.parse(semesterInfo);

  return validatedInfo;
}

/**
 * 計算學期內的週次
 *
 * @param date 計算日期
 * @param semester 可選的學期字串，不提供時會自動計算
 * @returns 週次數字
 */
export function calculateAcademicWeek(
  date: Date = new Date(),
  semester?: Semester
): number {
  const targetSemester = semester || getSemester(date);
  const semesterInfo = getSemesterInfo(targetSemester);

  // 計算從學期開始到指定日期的週數
  const diffTime = Math.abs(date.getTime() - semesterInfo.startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.max(1, Math.ceil(diffDays / 7));

  console.log(`[calculateAcademicWeek] 計算週次: 學期=${targetSemester}, 日期=${date.toISOString().split('T')[0]}, 週次=${weekNumber}`);

  return weekNumber;
}

/**
 * 取得下週一的日期（ISO 格式）
 *
 * @param referenceDate 參考日期，預設為當前日期
 * @returns 下週一的日期字串，格式 "YYYY-MM-DD"
 */
export function getNextMondayISO(referenceDate: Date = new Date()): string {
  const date = new Date(referenceDate);
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  // 計算到下週一的天數差
  const daysToNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  date.setDate(date.getDate() + daysToNextMonday);

  const nextMondayISO = date.toISOString().split('T')[0];

  console.log(`[getNextMondayISO] 計算下週一: 參考日期=${referenceDate.toISOString().split('T')[0]} → 下週一=${nextMondayISO}`);

  return nextMondayISO;
}

/**
 * 檢查日期是否在學期範圍內
 *
 * @param date 檢查日期
 * @param semester 學期字串
 * @returns 是否在學期範圍內
 */
export function isDateInSemester(date: Date, semester: Semester): boolean {
  const semesterInfo = getSemesterInfo(semester);
  return date >= semesterInfo.startDate && date <= semesterInfo.endDate;
}

/**
 * 取得當前或指定日期的學期週次資訊
 *
 * @param date 計算日期
 * @returns 包含學期和週次的資訊物件
 */
export function getCurrentSemesterWeek(date: Date = new Date()) {
  const semester = getSemester(date);
  const week = calculateAcademicWeek(date, semester);
  const semesterInfo = getSemesterInfo(semester);
  const weekStartISO = getNextMondayISO(date);

  return {
    semester,
    week,
    weekStartISO,
    semesterInfo,
    isInSemester: isDateInSemester(date, semester)
  };
}

/**
 * 測試用的學期計算範例
 *
 * @returns 測試案例結果
 */
export function getTestCases() {
  const testCases = [
    { date: '2025-01-20', expected: '113-1' },
    { date: '2025-02-15', expected: '113-2' },
    { date: '2025-09-10', expected: '114-1' },
    { date: '2026-03-05', expected: '114-2' },
    { date: '2024-08-01', expected: '113-1' },
    { date: '2024-12-31', expected: '113-1' },
    { date: '2025-07-31', expected: '113-2' },
  ];

  return testCases.map(testCase => {
    const date = new Date(testCase.date);
    const result = getSemester(date);
    const passed = result === testCase.expected;

    return {
      ...testCase,
      result,
      passed,
      semesterInfo: getSemesterInfo(result)
    };
  });
}