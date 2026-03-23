"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import ProjectsTable from "@/components/ProjectsTable";
import UserMenu from "@/components/UserMenu";

export default function Home() {
  const { user, loading, sendCode, verifyCode, signOut } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ── Full-screen spinner while session loads ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a0000]">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#cc0000]" />
      </div>
    );
  }

  // ── Signed-in: dashboard shell ───────────────────────────────────────────────
  if (user) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-white">
        {/* Top bar */}
        <header className="shrink-0 flex items-center justify-between bg-[#5c0000] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/30">
              <Image
                src="/pros-app-logo.webp"
                alt="Pros App"
                width={32}
                height={32}
                className="rounded-md"
              />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Pros App
            </span>
          </div>
          <UserMenu
            email={user.email}
            onSignOut={() =>
              signOut().then(() => {
                setStep("email");
                setCode("");
                setError("");
              })
            }
          />
        </header>

        {/* Table fills remaining height, no overflow here */}
        <div className="flex-1 overflow-hidden">
          <ProjectsTable />
        </div>
      </div>
    );
  }

  // ── Login helpers ────────────────────────────────────────────────────────────
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await sendCode(email.trim().toLowerCase());
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyCode(email.trim().toLowerCase(), code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  }

  // ── Login page ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a0000] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white px-10 py-10 shadow-2xl">
        {/* Logo + title */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black shadow-lg">
            <Image
              src="/pros-app-logo.webp"
              alt="Pros App"
              width={42}
              height={42}
              className="rounded-xl"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Pros App</h1>
            <p className="mt-0.5 text-sm text-gray-400">Portal Login</p>
          </div>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-[11px] font-bold uppercase tracking-widest text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@solarpros.io"
                required
                autoFocus
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#8b0000] focus:ring-2 focus:ring-[#8b0000]/20"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !email}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b0000] py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {busy && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {busy ? "Sending…" : "Get Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
            {/* Code sent to */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Code sent to
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-gray-800">{email}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="code"
                className="text-[11px] font-bold uppercase tracking-widest text-gray-700"
              >
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 7))}
                placeholder="·······"
                required
                autoFocus
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={7}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-gray-900 placeholder-gray-300 outline-none transition focus:border-[#8b0000] focus:ring-2 focus:ring-[#8b0000]/20 uppercase"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || code.length !== 7}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b0000] py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {busy && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {busy ? "Verifying…" : "Verify & Sign In"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="text-center text-xs text-gray-400 transition hover:text-gray-600 cursor-pointer"
            >
              ← Use a different email
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-gray-300">
          &copy; {new Date().getFullYear()} Solar Pros
        </p>
      </div>
    </div>
  );
}
