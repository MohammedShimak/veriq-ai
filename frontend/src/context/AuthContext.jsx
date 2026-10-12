import React, { createContext, useContext, useState, useEffect } from "react";
import { loginApi, signupApi, getMeApi } from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("accessToken"));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("refreshToken"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (accessToken) {
        try {
          const res = await getMeApi(accessToken);
          setUser(res.user);
        } catch (err) {
          console.warn("⚠️ Access token invalid or expired. Logging out...");
          logout();
        }
      }
      setLoading(false);
    }
    initAuth();
  }, [accessToken]);

  const login = async (email, password) => {
    const res = await loginApi(email, password);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    localStorage.setItem("accessToken", res.accessToken);
    localStorage.setItem("refreshToken", res.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const signup = async (name, email, password, role = "user") => {
    const res = await signupApi(name, email, password, role);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    localStorage.setItem("accessToken", res.accessToken);
    localStorage.setItem("refreshToken", res.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
