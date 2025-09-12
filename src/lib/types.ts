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
  1: '08:25-09:10',
  2: '09:20-10:05', 
  3: '10:15-11:00',
  4: '11:10-11:55',
  5: '13:15-14:00',
  6: '14:10-14:55',
  7: '15:05-15:50',
  8: '16:00-16:45'
}

export const LOCATIONS = {
  弘道: ['201', '202', '203', '204', '301', '302', '303', '304'],
  吉林: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']
}

export type LocationBase = keyof typeof LOCATIONS