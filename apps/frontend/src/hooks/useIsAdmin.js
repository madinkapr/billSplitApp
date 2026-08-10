import { useEffect, useState } from 'react'

const ADMIN_KEY_STORAGE = 'tabup_admin_key'

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => !!localStorage.getItem(ADMIN_KEY_STORAGE))

  useEffect(() => {
    function onStorage() {
      setIsAdmin(!!localStorage.getItem(ADMIN_KEY_STORAGE))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return isAdmin
}
