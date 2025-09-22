'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import HomeNavbar from '@/components/navigation/HomeNavbar'
import { Calendar, RotateCw, MapPin, BookOpen } from 'lucide-react'

export default function Home() {
  const { data: session } = useSession()
  const [selectedFeature, setSelectedFeature] = useState(0)

  const features = [
    {
      id: 0,
      title: '週課表管理',
      description: '直觀的週課表介面，輕鬆安排和調整課程時間',
      icon: Calendar,
      color: 'blue',
      image: '/home_page/0. inside_system_calendar.png'
    },
    {
      id: 1,
      title: 'Google Calendar 同步',
      description: '一鍵同步至 Google Calendar，隨時隨地查看課程安排',
      icon: RotateCw,
      color: 'green',
      image: '/home_page/1.google_calendar.png'
    },
    {
      id: 2,
      title: '課程庫管理',
      description: '建立並管理常用課程，快速套用至課表中',
      icon: BookOpen,
      color: 'purple',
      image: '/home_page/3.class_list.png'
    },
    {
      id: 3,
      title: '教室庫管理',
      description: '管理教室資訊，自動填入課程地點',
      icon: MapPin,
      color: 'orange',
      image: '/home_page/4.classroom_list.png'
    }
  ]

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colorMap = {
      blue: {
        bg: isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100',
        icon: isSelected ? 'bg-blue-500' : 'bg-blue-100',
        iconColor: isSelected ? 'text-white' : 'text-blue-600',
        text: isSelected ? 'text-white' : 'text-gray-900'
      },
      green: {
        bg: isSelected ? 'bg-green-600 text-white' : 'bg-green-50 hover:bg-green-100',
        icon: isSelected ? 'bg-green-500' : 'bg-green-100',
        iconColor: isSelected ? 'text-white' : 'text-green-600',
        text: isSelected ? 'text-white' : 'text-gray-900'
      },
      purple: {
        bg: isSelected ? 'bg-purple-600 text-white' : 'bg-purple-50 hover:bg-purple-100',
        icon: isSelected ? 'bg-purple-500' : 'bg-purple-100',
        iconColor: isSelected ? 'text-white' : 'text-purple-600',
        text: isSelected ? 'text-white' : 'text-gray-900'
      },
      orange: {
        bg: isSelected ? 'bg-orange-600 text-white' : 'bg-orange-50 hover:bg-orange-100',
        icon: isSelected ? 'bg-orange-500' : 'bg-orange-100',
        iconColor: isSelected ? 'text-white' : 'text-orange-600',
        text: isSelected ? 'text-white' : 'text-gray-900'
      }
    }
    return colorMap[color as keyof typeof colorMap]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <HomeNavbar />

      <main className="pt-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="text-blue-600">ClassSync</span>
              <br />
              智慧課表管理系統
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed">
              輕鬆管理週課表，自動同步至 Google Calendar
              <br />
              讓您專注於教學，而非時間管理
            </p>

            {session ? (
              <div className="space-y-4">
                <p className="text-lg text-green-600 font-medium">
                  歡迎回來，{session.user?.name}！
                </p>
                <Button asChild size="lg" className="text-lg px-8 py-4">
                  <Link href="/dashboard">
                    <Calendar className="w-5 h-5 mr-2" />
                    前往 Dashboard
                  </Link>
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => signIn('google')}
                size="lg"
                className="text-lg px-8 py-4 gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                開始使用 ClassSync
              </Button>
            )}

            <div className="mt-6 text-sm text-gray-500">
              <p>建議使用 T-school 學校帳號登入</p>
              <p className="text-red-500 mt-1">
                目前網頁驗證還沒通過，如果遇到不安全網頁，請點擊進階 → 前往「ClassSync」(不安全)
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Features Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              為什麼選擇 ClassSync？
            </h2>
            <p className="text-xl text-gray-600">
              專為教育工作者設計的智慧課表管理工具
            </p>
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-8">
              {/* Left side - Feature buttons */}
              <div className="lg:col-span-2 space-y-4">
                {features.map((feature) => {
                  const IconComponent = feature.icon
                  const isSelected = selectedFeature === feature.id
                  const colorClasses = getColorClasses(feature.color, isSelected)

                  return (
                    <button
                      key={feature.id}
                      onClick={() => setSelectedFeature(feature.id)}
                      className={`w-full p-6 rounded-xl text-left transition-all duration-300 transform hover:scale-105 ${colorClasses.bg}`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses.icon}`}>
                          <IconComponent className={`w-6 h-6 ${colorClasses.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold mb-2 ${colorClasses.text}`}>
                            {feature.title}
                          </h3>
                          <p className={`text-sm ${isSelected ? 'text-gray-100' : 'text-gray-600'}`}>
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Right side - Feature screenshot */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <div className="ml-4 text-sm text-gray-600 font-mono">
                        {features[selectedFeature].title} - ClassSync
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <img
                      src={features[selectedFeature].image}
                      alt={features[selectedFeature].title}
                      className="w-full h-auto transition-opacity duration-500"
                    />
                    {/* Loading overlay for smooth transitions */}
                    <div className="absolute inset-0 bg-gray-100 animate-pulse opacity-0 pointer-events-none"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                如何使用 ClassSync
              </h2>
              <p className="text-xl text-gray-600">
                三個簡單步驟，開始您的智慧課表管理
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8">

                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    1
                  </div>
                  <h3 className="text-xl font-semibold mb-2">設定課程與教室</h3>
                  <p className="text-gray-600">
                    在課程庫和教室庫中建立您的常用課程和教室資訊
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    2
                  </div>
                  <h3 className="text-xl font-semibold mb-2">排課</h3>
                  <p className="text-gray-600">
                    在週課表中點擊時段，選擇課程和地點完成排課
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    3
                  </div>
                  <h3 className="text-xl font-semibold mb-2">同步</h3>
                  <p className="text-gray-600">
                    點擊同步按鈕，將課表自動同步至 Google Calendar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              準備好開始了嗎？
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              立即使用 ClassSync，讓課表管理變得更簡單
            </p>

            {session ? (
              <Button asChild size="lg" className="text-lg px-8 py-4">
                <Link href="/dashboard">
                  <Calendar className="w-5 h-5 mr-2" />
                  前往 Dashboard
                </Link>
              </Button>
            ) : (
              <Button
                onClick={() => signIn('google')}
                size="lg"
                className="text-lg px-8 py-4 gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                立即開始使用
              </Button>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center mb-4">
              <img src="/favicon.ico" alt="ClassSync" className="w-6 h-6 rounded mr-2" />
              <span className="font-semibold">ClassSync</span>
            </div>
            <p className="text-gray-400 mb-4">
              智慧課表管理系統 - 讓教學更專注，管理更簡單
            </p>
            <div className="text-center">
              <Link
                href="/privacy"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                隱私權政策
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}