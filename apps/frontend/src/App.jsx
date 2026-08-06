import React from 'react'
import { useBillApp } from './hooks/useBillApp'
import { useIsDesktop } from './hooks/useIsDesktop'
import MobileApp from './mobile/MobileApp'
import DesktopApp from './desktop/DesktopApp'

export default function App() {
  const billApp = useBillApp()
  const isDesktop = useIsDesktop()

  return isDesktop ? <DesktopApp {...billApp} /> : <MobileApp {...billApp} />
}
