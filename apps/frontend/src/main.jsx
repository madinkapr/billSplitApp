import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import { AuthProvider } from './hooks/useAuth'
import './index.css'
import './i18n'
import './theme'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Screen transitions and other framer-motion animations respect "reduce motion". */}
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <App />
      </AuthProvider>
    </MotionConfig>
  </React.StrictMode>,
)
