import { describe, it, beforeEach, expect, vi } from 'vitest'

// Mocks
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user1' },
    accessToken: 'token',
  }),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { deleteManyMock, findManyMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
  findManyMock: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findMany: findManyMock,
      deleteMany: deleteManyMock,
    },
  },
}))

const { deleteEventMock } = vi.hoisted(() => ({
  deleteEventMock: vi.fn(),
}))
vi.mock('@/lib/google-calendar', () => ({
  GoogleCalendarService: vi.fn().mockImplementation(() => ({
    deleteEvent: deleteEventMock,
  })),
}))

vi.mock('@/lib/schedule-utils', () => ({ validateScheduleEvent: () => [] }))

// Import after mocks
import { POST } from './route'

describe('event deletion cleanup', () => {
  beforeEach(() => {
    deleteEventMock.mockReset()
    deleteManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  ;[404, 410].forEach(status => {
    it(`removes db record when calendar delete returns ${status}`, async () => {
      deleteEventMock.mockRejectedValueOnce({ code: status })
      const request = {
        json: async () => ({ events: [], eventsToDelete: ['evt-1'] }),
      } as any
      await POST(request, { params: Promise.resolve({ weekStart: '2024-01-01' }) })
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { userId: 'user1', calendarEventId: 'evt-1' },
      })
    })
  })
})
