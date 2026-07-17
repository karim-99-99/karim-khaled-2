import { createContext, useContext, useEffect, useState } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get("/auth/me/")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await client.post("/auth/login/", { email, password });
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    // New accounts can log in immediately with free-tier access
    // (first lesson + first 10 questions) until admin activates them.
    await client.post("/auth/register/", payload);
    return login(payload.email, payload.password);
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  async function refreshUser() {
    const res = await client.get("/auth/me/");
    setUser(res.data);
    return res.data;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
