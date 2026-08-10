import React, { useEffect, useState } from 'react'
import { useBillApp } from './hooks/useBillApp'
import { useIsDesktop } from './hooks/useIsDesktop'
import MobileApp from './mobile/MobileApp'
import DesktopApp from './desktop/DesktopApp'
import AdminStatsPage from './admin/AdminStatsPage'
import { trackPageView } from './utils/analytics'

function getRouteFromLocation() {
  return window.location.pathname === '/admin/stats' ? 'admin' : 'app'
}

export default function App() {
  const billApp = useBillApp()
  const isDesktop = useIsDesktop()
  const [route, setRoute] = useState(getRouteFromLocation)

  useEffect(() => {
    function onPopState() {
      setRoute(getRouteFromLocation())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    // Track once per real page load, not every time an admin bounces
    // between the stats dashboard and the app within the same session.
    if (getRouteFromLocation() === 'app') trackPageView()
  }, [])

  function goToStats() {
    window.history.pushState(null, '', '/admin/stats')
    setRoute('admin')
  }

  function goToApp(screen) {
    window.history.pushState(null, '', '/')
    setRoute('app')
    if (screen) billApp.navigate(screen)
  }

  if (route === 'admin') return <AdminStatsPage onBack={goToApp} />

  return isDesktop ? (
    <DesktopApp {...billApp} onOpenStats={goToStats} />
  ) : (
    <MobileApp {...billApp} onOpenStats={goToStats} />
  )
}
