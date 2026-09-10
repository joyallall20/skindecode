import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authService from '../services/authService.js';
import { getCurrentUser, authenticateFirebaseUser } from '../api/userApi.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const logoutPromiseRef = useRef(null);

  const syncApplicationUser = useCallback(async () => {
    let response;
    try {
      response = await authenticateFirebaseUser();
    } catch (error) {
      if (!error.isAuthError) throw error;
      response = await getCurrentUser();
    }

    const nextProfile = response?.data ?? response;
    setProfile(nextProfile);
    setIsAdmin(nextProfile?.role === 'admin');
    return nextProfile;
  }, []);

  const resolveProfile = useCallback(async () => {
    setAdminLoading(true);
    try {
      await syncApplicationUser();
    } catch {
      setProfile(null);
      setIsAdmin(false);
    } finally {
      setAdminLoading(false);
    }
  }, [syncApplicationUser]);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await resolveProfile();
      } else {
        setProfile(null);
        setIsAdmin(false);
        setAdminLoading(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [resolveProfile]);

  const login = useCallback((email, password) => authService.login(email, password), []);
  const loginWithGoogle = useCallback(() => authService.loginWithGoogle(), []);

  const signup = useCallback((email, password) => authService.signUp(email, password), []);

  const logout = useCallback(async () => {
    if (logoutPromiseRef.current) return logoutPromiseRef.current;

    logoutPromiseRef.current = (async () => {
      setLoading(true);
      try {
        await authService.logout();
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setAdminLoading(false);
      } finally {
        setLoading(false);
        logoutPromiseRef.current = null;
      }
    })();

    return logoutPromiseRef.current;
  }, []);

  const refreshToken = useCallback(() => authService.getIdToken(true), []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading: loading || adminLoading,
      isAuthenticated: Boolean(user),
      isAdmin,
      syncApplicationUser,
      login,
      loginWithGoogle,
      signup,
      logout,
      refreshToken,
    }),
    [user, profile, loading, adminLoading, isAdmin, syncApplicationUser, login, loginWithGoogle, signup, logout, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
