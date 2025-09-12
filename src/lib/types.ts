export interface Course {
  id: string
  name: string
  defaultUrl?: string
}

export interface ScheduleCell {
  courseId?: string
  courseName?: string
  location?: string
  url?: string
  isTemporary?: boolean
  venue?: string
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

export const LOCATIONS = {
  弘道: ['201', '202', '203', '204', '301', '302', '303', '304'],
  吉林: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']
}

export type LocationBase = keyof typeof LOCATIONS