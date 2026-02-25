import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STUDENT_EMAIL_REGEX = /^\d+@tschool\.tp\.edu\.tw$/

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: '請先登入' }, { status: 401 })
  }

  const email = session.user.email
  if (!email || !STUDENT_EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { message: '您的帳號不符合學號格式，請確認是否使用學校信箱登入' },
      { status: 403 }
    )
  }

  const rayUrl = process.env.RAY_URL
  const rayApiSecret = process.env.RAY_API_SECRET
  if (!rayUrl || !rayApiSecret) {
    return NextResponse.json({ message: '系統設定錯誤，請聯絡管理員' }, { status: 500 })
  }

  const studentId = email.split('@')[0]

  const rayResponse = await fetch(`${rayUrl}/public/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: studentId, apiKey: rayApiSecret }),
  })

  const data = await rayResponse.json()

  if (!rayResponse.ok || !data.success) {
    return NextResponse.json(
      { message: data.message || '課表抓取失敗，請稍後再試' },
      { status: 502 }
    )
  }

  return NextResponse.json(data)
}
