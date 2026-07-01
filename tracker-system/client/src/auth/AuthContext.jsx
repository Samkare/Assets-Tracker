import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api/client.js";
import { ROLE_RANK } from "@its/shared/constants";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await api.post("/auth/login", { email, password });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  }, []);

  const can = useCallback(
    (minRole) => !!user && (ROLE_RANK[user.role] || 0) >= ROLE_RANK[minRole],
    [user]
  );

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, can, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
