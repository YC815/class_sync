export interface CourseLink {
  id: string
  name: string
  url: string
  order?: number
}

export interface Course {
  id: string
  name: string
  links?: CourseLink[]
  createdAt: Date
  updatedAt: Date
}

export interface Base {
  id: string
  name: string
  address?: string
  placeId?: string
  isSingleRoom?: boolean
  rooms?: Room[]
  createdAt: Date
  updatedAt: Date
}

export interface Room {
  id: string
  name: string
  baseId: string
  base?: Base
  createdAt: Date
  updatedAt: Date
}

export interface ScheduleCell {
  courseId?: string
  courseName?: string
  location?: string
  url?: string
  isTemporary?: boolean
  venue?: string
  base?: string // 基地：弘道基地、吉林基地、線上、空
  room?: string // 教室：根據基地顯示對應列表
  placeId?: string // Google Places API Place ID
  address?: string // 基地地址
}

export interface WeekSchedule {
  [day: number]: {
    [period: number]: ScheduleCell | null
  }
}

export interface ScheduleEvent {
  weekday: number
  periodStart: number
  periodEnd: number
  courseId?: string
  courseName: string
  location?: string
  url?: string
  seriesId?: string
  action?: 'create' | 'update' | 'delete'
}

export const WEEKDAYS = ['週一', '週二', '週三', '週四', '週五']
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

export const PERIOD_TIMES = {
  1: '08:25-09:15',
  2: '09:15-10:05',
  3: '10:15-11:05',
  4: '11:05-11:55',
  5: '13:25-14:15',
  6: '14:15-15:05',
  7: '15:15-16:05',
  8: '16:05-16:55'
}

// 基地信息接口
export interface BaseInfo {
  id: string
  name: string
  placeId?: string
  address?: string
}

// 基地選項
export const BASES = {
  弘道基地: 'hongdao',
  吉林基地: 'jilin', 
  線上: 'online',
  空: 'empty'
} as const

export type BaseType = keyof typeof BASES

// 基地詳細信息
export const BASE_INFO: Record<string, BaseInfo> = {
  hongdao: {
    id: 'hongdao',
    name: '臺北市數位實驗高級中等學校弘道基地',
    placeId: 'ChIJMXNVdQCpQjQR-zaiQx0-y-M',
    address: '100台灣台北市中正區公園路21號'
  },
  jilin: {
    id: 'jilin', 
    name: '臺北市數位實驗高級中等學校吉林基地',
    placeId: 'ChIJP7m5t_apQjQRUNlba2WAsm8',
    address: '104台灣台北市中山區吉林路110號'
  },
  online: {
    id: 'online',
    name: '線上課程',
    placeId: undefined,
    address: undefined
  },
  empty: {
    id: 'empty',
    name: '空堂',
    placeId: undefined,
    address: undefined
  }
}

// 根據基地的教室列表
export const ROOMS_BY_BASE = {
  hongdao: ['201', '202', '203', '204', '301', '302', '303', '304'],
  jilin: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'],
  online: [], // 線上不需要教室選擇
  empty: []   // 空不需要教室選擇
} as const

// 為了向後兼容，保留舊的 LOCATIONS
export const LOCATIONS = {
  弘道: ['201', '202', '203', '204', '301', '302', '303', '304'],
  吉林: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']
}

export type LocationBase = keyof typeof LOCATIONS