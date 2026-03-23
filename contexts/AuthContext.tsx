"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.email) setUser({ email: data.email });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function sendCode(email: string): Promise<void> {
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to send code");
    }
  }

  async function verifyCode(email: string, code: string): Promise<void> {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: code.trim().toUpperCase() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Invalid or expired code");
    }
    const data = await res.json();
    setUser({ email: data.email });
  }

  async function signOut(): Promise<void> {
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, sendCode, verifyCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
