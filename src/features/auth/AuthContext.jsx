import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { accountService } from '../../services/accountService.js'

const AuthContext = createContext(null)
export const normalizePermission = permission => permission?.trim().toLocaleLowerCase('pt-BR') || ''
const CUSTOMER_PERMISSIONS = new Set(['cliente'])
const ADMIN_PERMISSIONS = new Set(['admin', 'gestor', 'dashboard'])
export const isCustomer = user => CUSTOMER_PERMISSIONS.has(normalizePermission(user?.permission))
export const hasAdminAccess = user => ADMIN_PERMISSIONS.has(normalizePermission(user?.permission))
export const getAuthenticatedHome = user => isCustomer(user) ? '/minha-conta' : hasAdminAccess(user) ? '/admin' : '/entrar'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const refreshSession = useCallback(async () => { setIsLoadingSession(true); setSessionError(''); try { const next = await accountService.rawSession(); setUser(next); return next } catch (error) { setUser(null); setSessionError(error.message || 'Não foi possível validar sua sessão.'); return null } finally { setIsLoadingSession(false) } }, [])
  useEffect(() => { refreshSession() }, [refreshSession])
  const login = useCallback(async credentials => { const user = await accountService.loginRaw(credentials); setUser(user); return user }, [])
  const register = useCallback(async data => { const user = await accountService.registerRaw(data); setUser(user); return user }, [])
  const logout = useCallback(async () => { try { await accountService.logout() } finally { setUser(null) } }, [])
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isLoadingSession, sessionError, login, register, logout, refreshSession, isCustomer: isCustomer(user), hasAdminAccess: hasAdminAccess(user) }), [user, isLoadingSession, sessionError, login, register, logout, refreshSession])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider ausente.'); return value }
