import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as minehut from "./api.js";
import { BrowserSession } from "./browser.js";
import { envEmail, headlessEnabled } from "./config.js";
import { promises as fsp } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const server = new McpServer({
  name: "minehut-mcp",
  version: "1.0.0",
});

const browser = new BrowserSession();

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// ---------------- API tools ----------------

server.registerTool(
  "minehut_status",
  {
    title: "Minehut server status",
    description:
      "Get the status, player count, RAM, MOTD, version and plugins of a Minehut server. Accepts the server name or its id.",
    inputSchema: {
      server: z.string().describe("Server name or id"),
    },
  },
  async ({ server: name }) => {
    try {
      const info = await minehut.fetchServerInfo(name);
      let players: string[] = [];
      try {
        players = await minehut.fetchOnlinePlayers(name, info);
      } catch {
        // player list is optional
      }
      return {
        content: [
          {
            type: "text",
            text: minehut.summarize(info) + (players.length ? `\n\nonline players:\n${players.join(", ")}` : ""),
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "minehut_servers",
  {
    title: "List Minehut servers",
    description: "List all servers on the logged-in Minehut account with their current status.",
    inputSchema: {},
  },
  async () => {
    try {
      const list = await minehut.listServers();
      if (list.length === 0) {
        return {
          content: [{ type: "text", text: "No servers found on this account, or the session has no servers." }],
        };
      }
      const out = list.map((s) => `${s.name} | online: ${s.online} | ${s.players}/${s.maxPlayers} players | ${s.ram}GB | ${s.version ?? "?"}`).join("\n");
      return { content: [{ type: "text", text: out }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

function apiStartStop(method: "start" | "stop") {
  return async ({ server: name }: { server: string }): Promise<{ content: { type: "text"; text: string }[] }> => {
    try {
      const info = await minehut.fetchServerInfo(name);
      const result =
        method === "start" ? await minehut.startServer(name, info) : await minehut.stopServer(name, info);
      return {
        content: [
          {
            type: "text",
            text: method === "start"
              ? `${info.name} is starting. It can take a few minutes to come online. Poll minehut_status to confirm.`
              : `${info.name} is shutting down. Poll minehut_status to confirm.`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  };
}

server.registerTool(
  "minehut_start",
  { title: "Start a Minehut server", description: "Power on a Minehut server by name or id.", inputSchema: { server: z.string() } },
  apiStartStop("start"),
);

server.registerTool(
  "minehut_stop",
  { title: "Stop a Minehut server", description: "Power off a Minehut server by name or id.", inputSchema: { server: z.string() } },
  apiStartStop("stop"),
);

server.registerTool(
  "minehut_restart",
  {
    title: "Restart a Minehut server",
    description: "Stop and start a Minehut server again.",
    inputSchema: { server: z.string() },
  },
  async ({ server: name }) => {
    try {
      const info = await minehut.fetchServerInfo(name);
      await minehut.stopServer(name, info);
      await new Promise((r) => setTimeout(r, 4000));
      await minehut.startServer(name, info);
      return {
        content: [
          {
            type: "text",
            text: `${info.name} is restarting. Poll minehut_status to confirm it comes back online.`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "minehut_command",
  {
    title: "Send a server command",
    description:
      "Send any console command to a Minehut server (runs with operator privileges), e.g. 'say hello', 'time set day', 'give Inxx diamond 64', 'lp user Inxx group set admin'.",
    inputSchema: {
      server: z.string().describe("Server name or id"),
      command: z.string().describe("The console command to run"),
    },
  },
  async ({ server: name, command }) => {
    try {
      const info = await minehut.fetchServerInfo(name);
      const res = await minehut.sendCommand(name, command, info);
      return {
        content: [
          {
            type: "text",
            text: `Command sent to ${info.name}: "${command}"${res?.data?.message ? ` (${res.data.message})` : ""}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "minehut_logs",
  {
    title: "Read server logs",
    description: "Read the most recent log lines of a Minehut server (useful to check console output, crashes, errors).",
    inputSchema: {
      server: z.string(),
      lines: z.number().int().positive().max(500).default(100).describe("Number of log lines to return"),
    },
  },
  async ({ server: name, lines }) => {
    try {
      const info = await minehut.fetchServerInfo(name);
      const log = await minehut.fetchServerLog(name, info, lines);
      return { content: [{ type: "text", text: log || "(log is empty)" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "minehut_upgrade_ram",
  {
    title: "Change server RAM",
    description: "Change the RAM allocation of a Minehut server. Minehut limits total RAM based on your plan.",
    inputSchema: {
      server: z.string(),
      ram: z.number().int().min(1).describe("New RAM in GB, for example 2 or 4"),
    },
  },
  async ({ server: name, ram }) => {
    try {
      const info = await minehut.fetchServerInfo(name);
      const res = await minehut.upgradeRam(name, ram, info);
      return {
        content: [
          {
            type: "text",
            text: `RAM change requested for ${info.name} to ${ram}GB. Server may restart. Poll minehut_status.${res?.data?.message ? ` (${res.data.message})` : ""}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

// ---------------- Browser tools ----------------

server.registerTool(
  "browser_open",
  {
    title: "Open a page in the Minehut browser",
    description:
      "Open a URL in the controlled browser (defaults to the Minehut dashboard) and return the page title, current URL and visible text so the AI understands the page.",
    inputSchema: {
      url: z.string().default("https://dashboard.minehut.com").describe("Full URL to open"),
    },
  },
  async ({ url }) => {
    try {
      const page = await browser.ensurePage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1200);
      const title = await page.title();
      const text = (await page.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "")).trim();
      return {
        content: [
          { type: "text", text: `title: ${title}\nurl: ${page.url()}\n\npage text:\n${text || "(empty)"}` },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_login_panel",
  {
    title: "Log into the Minehut panel",
    description:
      "Log into the Minehut dashboard in the controlled browser using the provided credentials or MINEHUT_EMAIL and MINEHUT_PASSWORD. Captures the API session automatically when possible. Cloudflare challenges may need browser_wait_manual afterward.",
    inputSchema: {
      email: z.string().optional(),
      password: z.string().optional(),
    },
  },
  async ({ email, password }) => {
    try {
      const text = await browser.loginPanel(email, password);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_wait_manual",
  {
    title: "Wait for manual UI login",
    description:
      "Wait a number of seconds while the user finishes a manual action in the visible browser (Cloudflare challenge, 2FA, password manager), then capture the session tokens.",
    inputSchema: {
      seconds: z.number().int().positive().default(30),
    },
  },
  async ({ seconds }) => {
    try {
      const text = await browser.waitManual(seconds);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_click",
  {
    title: "Click an element",
    description:
      "Click the first visible element matching a CSS selector, e.g. 'button:has-text(\"Start\")', '.server-row', 'a[href*=\"/console\"]'.",
    inputSchema: {
      selector: z.string(),
    },
  },
  async ({ selector }) => {
    try {
      const page = await browser.ensurePage();
      const el = page.locator(selector).first();
      await el.waitFor({ state: "visible", timeout: 15_000 });
      await el.click();
      await page.waitForTimeout(800);
      return { content: [{ type: "text", text: `Clicked ${selector}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_type",
  {
    title: "Type into an element",
    description: "Type text into the first visible element matching a selector. Optionally press Enter afterwards.",
    inputSchema: {
      selector: z.string(),
      text: z.string(),
      press_enter: z.boolean().default(false),
    },
  },
  async ({ selector, text, press_enter }) => {
    try {
      const page = await browser.ensurePage();
      const el = page.locator(selector).first();
      await el.waitFor({ state: "visible", timeout: 15_000 });
      await el.fill("");
      await el.type(text, { delay: 10 });
      if (press_enter) await el.press("Enter");
      await page.waitForTimeout(400);
      return { content: [{ type: "text", text: `Typed into ${selector}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_press",
  {
    title: "Press a key",
    description: "Press a keyboard key on the page, e.g. Enter, Escape, Tab, F5.",
    inputSchema: {
      key: z.string(),
    },
  },
  async ({ key }) => {
    try {
      const page = await browser.ensurePage();
      await page.keyboard.press(key);
      await page.waitForTimeout(400);
      return { content: [{ type: "text", text: `Pressed ${key}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_text",
  {
    title: "Read text from the page",
    description: "Return the visible text of an element (or the whole page when no selector is given) so the AI can read the current state of the panel.",
    inputSchema: {
      selector: z.string().optional().describe("CSS selector. Omitting returns the whole page text."),
      max_chars: z.number().int().positive().max(20000).default(8000),
    },
  },
  async ({ selector, max_chars }) => {
    try {
      const page = await browser.ensurePage();
      const text = selector
        ? await page.locator(selector).first().innerText({ timeout: 10_000 })
        : ((await page.evaluate(() => document.body?.innerText ?? "")) as string);
      return { content: [{ type: "text", text: text.slice(0, max_chars) || "(empty)" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_screenshot",
  {
    title: "Take a screenshot",
    description:
      "Take a screenshot of the page (or of one element) and return it as an image plus the saved file path. The AI can read the image contents.",
    inputSchema: {
      selector: z.string().optional().describe("Screenshot only this element"),
      full_page: z.boolean().default(false),
    },
  },
  async ({ selector, full_page }) => {
    try {
      const page = await browser.ensurePage();
      const shot = selector
        ? await page.locator(selector).first().screenshot({ timeout: 15_000 })
        : await page.screenshot({ fullPage: full_page });
      const file = join(homedir(), ".minehut-mcp", `shot-${Date.now()}.png`);
      await fsp.mkdir(join(homedir(), ".minehut-mcp"), { recursive: true });
      await fsp.writeFile(file, shot);
      return {
        content: [
          { type: "text", text: `saved: ${file}` },
          { type: "image", data: shot.toString("base64"), mimeType: "image/png" },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_evaluate",
  {
    title: "Run JavaScript in the page",
    description:
      "Run a small JavaScript expression in the dashboard page and return its result. Useful for reading React state, clicking via JS, or advanced automation.",
    inputSchema: {
      js: z.string().describe("JavaScript expression or IIFE to evaluate in the page context"),
    },
  },
  async ({ js }) => {
    try {
      const page = await browser.ensurePage();
      const result = await page.evaluate(`(() => { try { return ${js}; } catch (err) { return String(err); } })()`);
      return {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${errText(e)}` }] };
    }
  },
);

server.registerTool(
  "browser_close",
  {
    title: "Close the browser",
    description: "Close the controlled browser window and release resources.",
    inputSchema: {},
  },
  async () => {
    await browser.close();
    return { content: [{ type: "text", text: "Browser closed." }] };
  },
);

server.registerTool(
  "minehut_help",
  {
    title: "Minehut MCP help",
    description:
      "Show a short guide about how to use this server, including the recommended flow for first-time setup with Minehut.",
    inputSchema: {},
  },
  async () => {
    const headless = headlessEnabled() ? "headless" : "headed";
    return {
      content: [
        {
          type: "text",
          text: [
            `minehut-mcp is running (browser mode: ${headless}).`,
            "",
            "Recommended first-time flow:",
            "1. Call browser_login_panel with the Minehut account email and password. A browser will open the Minehut dashboard.",
            "2. If a Cloudflare challenge or 2FA appears, call browser_wait_manual so the user can complete it, then the API session is captured.",
            "3. Use minehut_servers and minehut_status to inspect the account.",
            "4. Control servers with minehut_start, minehut_stop, minehut_restart, minehut_command, minehut_logs.",
            "5. For anything not covered by the API tools (plugins UI, settings, skins, billing, etc.), use the browser_* tools to operate the actual dashboard.",
            "",
            "Credentials can also be provided via MINEHUT_EMAIL and MINEHUT_PASSWORD environment variables.",
            "A captured session is stored in ~/.minehut-mcp/session.json (file permissions 600).",
            "",
            "Safety: console commands run with operator privileges. Reset and deletion flows are never automated by default.",
          ].join("\n"),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[minehut-mcp] server ready. Tools: minehut_* and browser_*.\n");
}

main().catch((err) => {
  process.stderr.write(`[minehut-mcp] fatal: ${errText(err)}\n`);
  process.exit(1);
});