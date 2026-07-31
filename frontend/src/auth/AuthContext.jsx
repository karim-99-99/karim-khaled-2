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

  async function acceptTokens(data) {
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    setUser(data.user);
    return data.user;
  }

  async function login(credentials, maybePassword) {
    let body;
    if (typeof credentials === "string") {
      body = {
        email: credentials,
        password: maybePassword,
        login_method: "email",
      };
    } else {
      const method = credentials.method || credentials.login_method || "email";
      body = {
        login_method: method,
        password: credentials.password,
      };
      if (method === "email") {
        body.email = credentials.email;
      } else {
        body.phone = credentials.phone;
      }
    }
    const { data } = await client.post("/auth/login/", body);
    return acceptTokens(data);
  }

  async function register(payload) {
    await client.post("/auth/register/", payload);
    try {
      return await login({
        method: "email",
        email: payload.email,
        password: payload.password,
      });
    } catch (err) {
      const e = new Error("ACCOUNT_CREATED_LOGIN_FAILED");
      e.cause = err;
      throw e;
    }
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
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        acceptTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
