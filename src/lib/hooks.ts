'use client'

import { useLayoutEffect, useCallback } from 'react'

export function useNavbarHeight(navbarRef?: React.RefObject<HTMLElement>) {
  const updateNavbarHeight = useCallback(() => {
    // 優先使用傳入的 ref，否則嘗試找到 nav 元素
    const navbar = navbarRef?.current || document.querySelector('nav[data-navbar]')
    
    if (navbar) {
      const height = navbar.getBoundingClientRect().height
      // 響應式最小高度：寬螢幕 120px，窄螢幕 200px
      const isWideScreen = window.innerWidth >= 768 // md breakpoint
      const minHeight = isWideScreen ? 120 : 200
      const totalHeight = Math.max(height, minHeight)
      
      // 更新 CSS 變量
      document.documentElement.style.setProperty('--navbar-height', `${totalHeight}px`)
      
      // Debug 資訊（生產環境可移除）
      if (process.env.NODE_ENV === 'development') {
        console.log(`Navbar height updated: ${totalHeight}px (measured: ${height}px, min: ${minHeight}px, screen: ${isWideScreen ? 'wide' : 'narrow'})`)
      }
    }
  }, [navbarRef])

  useLayoutEffect(() => {
    // 初始設定
    updateNavbarHeight()

    // 監聽視窗大小變化
    const handleResize = () => {
      updateNavbarHeight()
    }

    window.addEventListener('resize', handleResize)
    
    // 使用 MutationObserver 監聽 DOM 變化（處理動態內容）
    const observer = new MutationObserver(() => {
      updateNavbarHeight()
    })

    const navbar = navbarRef?.current || document.querySelector('nav[data-navbar]')
    if (navbar) {
      observer.observe(navbar, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['class', 'style'] 
      })
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [updateNavbarHeight, navbarRef])

  return updateNavbarHeight
}