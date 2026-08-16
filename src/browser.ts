import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { headlessEnabled, envEmail, envPassword, saveSession, effectiveSession } from "./config.js";

const PANEL_URL = "https://dashboard.minehut.com";
const PROFILE_DIR = join(homedir(), ".minehut-mcp", "browser-profile");

const TOKEN_KEYS = ["minehut_auth_token", "auth_token", "token", "access_token"];
const SESSION_KEYS = ["minehut_session_id", "session_id", "x-session-id", "sessionId", "minehutSessionId"];

export class BrowserSession {
  private browser: Browser | null = null;
  page: Page | null = null;

  async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;
    try {
      const context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: headlessEnabled(),
        viewport: { width: 1400, height: 900 },
        acceptDownloads: true,
      });
      this.browser = context.browser();
      this.page = context.pages()[0] ?? (await context.newPage());
      return this.page;
    } catch (err: any) {
      if (/Executable doesn't exist|browserType\.launch/.test(String(err?.message ?? ""))) {
        throw new Error(
          "Chromium is not installed. Run: npx playwright install chromium",
        );
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.page = null;
  }

  private async captureTokens(): Promise<{ token?: string; sessionId?: string }> {
    const page = await this.ensurePage();
    try {
      const found = await page.evaluate(([tKeys, sKeys]) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v && v.length > 5) return v;
          }
          return "";
        };
        return { token: get(tKeys), session: get(sKeys) };
      }, [TOKEN_KEYS, SESSION_KEYS]);

      let token: string | undefined;
      let sessionId: string | undefined;
      if (typeof found?.token === "string" && found.token) token = found.token;
      if (typeof found?.session === "string" && found.session) sessionId = found.session;
      if (token || sessionId) {
        saveSession({ token, sessionId });
        return { token, sessionId };
      }
      return {};
    } catch {
      return {};
    }
  }

  async loginPanel(email?: string, password?: string): Promise<string> {
    const page = await this.ensurePage();
    const credEmail = email ?? envEmail();
    const credPassword = password ?? envPassword();

    const stored = effectiveSession();
    if (stored.token && stored.sessionId) {
      await page.goto(PANEL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await this.captureTokens();
      return "Session from config used. Opened the Minehut dashboard. The AI can now inspect the page and click through the panel.";
    }

    if (!credEmail || !credPassword) {
      await page.goto(PANEL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      return (
        "No credentials provided (set MINEHUT_EMAIL and MINEHUT_PASSWORD, or pass email and password). " +
        "The dashboard is open. A Cloudflare challenge may need to be solved manually: run browser_wait_manual after you finish logging in, so this server can capture your session."
      );
    }

    await page.goto(PANEL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});

    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="mail" i]',
      "#email",
    ];
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
      "#password",
    ];

    const emailInput = await this.firstVisible(emailSelectors);
    if (emailInput) {
      await emailInput.fill(credEmail);
      const pwdInput = await this.firstVisible(passwordSelectors);
      if (pwdInput) {
        await pwdInput.fill(credPassword);
        const submit = await this.firstVisible([
          'button[type="submit"]',
          'input[type="submit"]',
          "button:has-text('Log in')",
          "button:has-text('Sign in')",
          "button:has-text('Login')",
          "button:has-text('Continue')",
        ]);
        if (submit) {
          await submit.click();
          await page.waitForTimeout(2500);
        }
      }
    }

    const captured = await this.captureTokens();
    if (captured.token && captured.sessionId) {
      return (
        "Login successful. Session token captured and saved to ~/.minehut-mcp/session.json. " +
        "The AI can now use the API tools (start, stop, command, logs) and the browser tools (click, type, screenshot) on the dashboard."
      );
    }

    return (
      "Login form filled and submitted. No API session token was detected yet. " +
      "The dashboard is open in a browser. If a Cloudflare challenge appeared, finish it manually and run browser_wait_manual."
    );
  }

  async waitManual(seconds: number): Promise<string> {
    const page = await this.ensurePage();
    await page.waitForTimeout(seconds * 1000);
    const captured = await this.captureTokens();
    const stored = effectiveSession();
    if (captured.token && captured.sessionId) {
      return "Session captured. API tools are now active.";
    }
    return stored.token && stored.sessionId
      ? "Still no fresh tokens, but a previous session exists and will be used."
      : "No session detected yet. Complete the login in the browser window, then call browser_wait_manual again.";
  }

  private async firstVisible(selectors: string[]): Promise<any | null> {
    const page = await this.ensurePage();
    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        if ((await el.count()) && (await el.isVisible({ timeout: 800 }).catch(() => false))) {
          return el;
        }
      } catch {
        // keep trying
      }
    }
    return null;
  }
}

export function screenshotToDataUrl(buf: Buffer, mime: string): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}