"use client";

import React, { useEffect, useRef, useState } from "react";

function Avatar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-gray-200 to-gray-300 ${className}`}
      aria-hidden
    >
      <svg
        className="h-[55%] w-[55%] text-gray-500"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

interface UserMenuProps {
  email: string;
  onSignOut: () => void | Promise<void>;
}

export default function UserMenu({ email, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg py-1 pl-2 pr-1 transition hover:bg-white/10 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className="max-w-[12rem] truncate text-left text-base font-medium tracking-tight text-white sm:max-w-[18rem] sm:text-[17px]"
          title={email}
        >
          {email}
        </span>
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,20rem)] rounded-xl border border-gray-100 bg-white py-3 shadow-xl ring-1 ring-black/5"
          role="menu"
        >
          {/* Email */}
          <div className="flex gap-3 px-4 pb-2">
            <Avatar className="h-14 w-14 rounded-lg" />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="break-all text-lg font-semibold leading-snug text-gray-900">
                {email}
              </p>
            </div>
          </div>

          <div className="px-3 pb-1 pt-1">
            <button
              type="button"
              role="menuitem"
              className="w-full rounded-xl bg-[#5c0000] py-2.5 text-sm font-semibold text-white transition hover:bg-[#6d0d0d] cursor-pointer"
              onClick={() => {
                setOpen(false);
                void onSignOut();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
