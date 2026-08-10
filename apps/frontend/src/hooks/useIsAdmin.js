import { useEffect, useState } from 'react'

const ADMIN_TOKEN_STORAGE = 'tabup_admin_token'

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => !!localStorage.getItem(ADMIN_TOKEN_STORAGE))

  useEffect(() => {
    function onStorage() {
      setIsAdmin(!!localStorage.getItem(ADMIN_TOKEN_STORAGE))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return isAdmin
}
