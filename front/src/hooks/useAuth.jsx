import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { memberApi } from '../api/memberApi'

const AuthContext = createContext(null)

// 로그인한 회원 정보를 앱 전체에서 공유한다. member가 null이면 익명(deviceId) 사용자.
export function AuthProvider({ children }) {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    memberApi
      .me()
      .then(setMember)
      .catch(() => setMember(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (form) => {
    const { data } = await memberApi.login(form)
    setMember(data)
    return data
  }, [])

  const signup = useCallback(async (form) => {
    const { data } = await memberApi.signup(form)
    setMember(data)
    return data
  }, [])

  const logout = useCallback(async () => {
    await memberApi.logout()
    setMember(null)
  }, [])

  return <AuthContext.Provider value={{ member, loading, login, signup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
