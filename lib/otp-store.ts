interface OtpEntry {
  code: string;
  expiresAt: number;
}

// Persist on globalThis so hot-reload in dev doesn't wipe codes
declare global {
  // eslint-disable-next-line no-var
  var __otpStore: Map<string, OtpEntry> | undefined;
}

function getStore(): Map<string, OtpEntry> {
  if (!globalThis.__otpStore) {
    globalThis.__otpStore = new Map();
  }
  return globalThis.__otpStore;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function setOtp(email: string, code: string): void {
  getStore().set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

export function verifyOtp(email: string, code: string): boolean {
  const store = getStore();
  const entry = store.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return false;
  }
  if (entry.code !== code) return false;
  store.delete(email.toLowerCase());
  return true;
}
