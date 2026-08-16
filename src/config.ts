import { homedir } from "node:os";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";

export interface StoredSession {
  token?: string;
  sessionId?: string;
  email?: string;
  savedAt?: string;
}

const CONFIG_DIR = join(homedir(), ".minehut-mcp");
const CONFIG_FILE = join(CONFIG_DIR, "session.json");

export function envEmail(): string | undefined {
  return process.env.MINEHUT_EMAIL || undefined;
}

export function envPassword(): string | undefined {
  return process.env.MINEHUT_PASSWORD || undefined;
}

export function envToken(): string | undefined {
  return process.env.MINEHUT_TOKEN || undefined;
}

export function envSessionId(): string | undefined {
  return process.env.MINEHUT_SESSION_ID || undefined;
}

export function headlessEnabled(): boolean {
  return process.env.MINEHUT_HEADLESS !== "0" && process.env.MINEHUT_HEADLESS !== "false";
}

export function loadSession(): StoredSession {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as StoredSession;
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

export function saveSession(partial: Partial<StoredSession>): StoredSession {
  const next = { ...loadSession(), ...partial, savedAt: new Date().toISOString() };
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // best effort
  }
  return next;
}

export function effectiveSession(): StoredSession {
  const stored = loadSession();
  return {
    token: envToken() || stored.token || undefined,
    sessionId: envSessionId() || stored.sessionId || undefined,
    email: envEmail() || stored.email || undefined,
  };
}