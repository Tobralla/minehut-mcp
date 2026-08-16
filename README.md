<div align="center">

# ⛏️ Minehut MCP

**Let any AI agent fully manage your [Minehut](https://minehut.com) Minecraft server.**

Works with **Claude Code, Codex, opencode, Cursor, Hermes** and any other MCP client.

![MCP](https://img.shields.io/badge/MCP-server-8B5CF6?logo=modelcontextprotocol&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-18+-43853d?logo=node.js&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-browser-45ba4b?logo=playwright&logoColor=white)

</div>

---

## What it does

Two complementary layers, one install:

| Layer | Tools | What the AI can do |
|---|---|---|
| 🖥️ **Browser automation** (Playwright) | `browser_open`, `browser_click`, `browser_type`, `browser_press`, `browser_text`, `browser_screenshot`, `browser_evaluate`, `browser_login_panel`, `browser_wait_manual`, `browser_close` | Drive the real [Minehut dashboard](https://dashboard.minehut.com) like a human. Handles Cloudflare, the login form, and every UI feature: plugins, players, world settings, files, billing, skins. **This is the "do everything" layer.** |
| ⚡ **Minehut API** (REST) | `minehut_servers`, `minehut_status`, `minehut_start`, `minehut_stop`, `minehut_restart`, `minehut_command`, `minehut_logs`, `minehut_upgrade_ram` | Fast, scriptable control. Start/stop servers, send console commands (`say`, `give`, LuckPerms, etc.), read logs, check players. |

Plus `minehut_help` for an in-server guide.

## 🚀 Install

One-time setup on your machine:

```bash
# 1. Install globally (any package manager works)
npm install -g github:Tobralla/minehut-mcp

# 2. Install Chromium for the browser layer
minehut-mcp-setup
```

For local development:

```bash
git clone https://github.com/Tobralla/minehut-mcp.git
cd minehut-mcp
npm install
npm run dev
```

### Environment variables (optional)

| Variable | Purpose |
|---|---|
| `MINEHUT_EMAIL` / `MINEHUT_PASSWORD` | Used by `browser_login_panel` when credentials are not passed per call |
| `MINEHUT_TOKEN` / `MINEHUT_SESSION_ID` | Direct API session (captured automatically after browser login) |
| `MINEHUT_HEADLESS=0` | Run the browser visibly (recommended for the first login, Cloudflare is friendlier with a visible window) |

## 🔑 First-time login

1. Ask your AI to run `browser_login_panel` with your Minehut email and password.
2. A browser opens the dashboard and fills the login form.
3. A Cloudflare challenge or 2FA may appear. Run `browser_wait_manual` so you can finish it by hand.
4. The session token is captured automatically and stored in `~/.minehut-mcp/session.json` (permissions 600). All `minehut_*` API tools become active.

> Set `MINEHUT_HEADLESS=0` in the client config below for a visible browser window on first login.

## 🔌 Client setup

### Claude Code

```bash
claude mcp add minehut-mcp \
  --env MINEHUT_EMAIL=you@example.com \
  --env MINEHUT_PASSWORD='your password' \
  -- npx -y github:Tobralla/minehut-mcp
```

### Codex (OpenAI)

```bash
codex mcp add minehut-mcp \
  --env MINEHUT_EMAIL=you@example.com \
  --env MINEHUT_PASSWORD='your password' \
  -- npx -y github:Tobralla/minehut-mcp
```

### opencode

Add to `opencode.json` in your project, or `~/.config/opencode/opencode.json` for all projects:

```json
{
  "mcp": {
    "minehut": {
      "type": "local",
      "command": ["npx", "-y", "github:Tobralla/minehut-mcp"],
      "enabled": true,
      "environment": {
        "MINEHUT_EMAIL": "you@example.com",
        "MINEHUT_PASSWORD": "your password"
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project (or use *Settings > MCP*):

```json
{
  "mcpServers": {
    "minehut": {
      "command": "npx",
      "args": ["-y", "github:Tobralla/minehut-mcp"],
      "env": {
        "MINEHUT_EMAIL": "you@example.com",
        "MINEHUT_PASSWORD": "your password"
      }
    }
  }
}
```

### Hermes

Add to `hermes.toml` (or `config.toml`):

```toml
[mcp.servers.minehut]
command = "npx"
args = ["-y", "github:Tobralla/minehut-mcp"]
env = { MINEHUT_EMAIL = "you@example.com", MINEHUT_PASSWORD = "your password" }
```

## 💡 Example prompts

```
Start my survival server and tell me how many players are online
```

```
Install a plugin on my server. Use the dashboard.
```

```
Give Inxx 64 diamonds on my server
```

```
Why did my server crash last night? Check the logs
```

```
Change my server RAM to 4GB and restart it
```

```
Find out what my server MOTD currently says
```

## 🛠️ Full tool list

| Tool | Description |
|---|---|
| `minehut_status <server>` | Status, players, RAM, MOTD, version, plugins |
| `minehut_servers` | List all servers on the account |
| `minehut_start <server>` | Power on the server |
| `minehut_stop <server>` | Power off the server |
| `minehut_restart <server>` | Restart the server |
| `minehut_command <server> <command>` | Send a console command (operator privileges) |
| `minehut_logs <server> [lines]` | Read recent console output |
| `minehut_upgrade_ram <server> <gb>` | Change RAM allocation |
| `browser_open [url]` | Open the dashboard and read the page |
| `browser_login_panel [email] [password]` | Log in and capture the API session |
| `browser_wait_manual [seconds]` | Wait for a manual challenge/2FA, then capture the session |
| `browser_click <selector>` | Click an element |
| `browser_type <selector> <text> [enter]` | Type into an element |
| `browser_press <key>` | Send a keyboard key |
| `browser_text [selector]` | Read visible text of the page or an element |
| `browser_screenshot [selector]` | Screenshot the page as an image the AI can see |
| `browser_evaluate <js>` | Run JavaScript in the dashboard page |
| `browser_close` | Close the browser |

## ⚠️ Safety notes

- Console commands run with **operator privileges**. Review what you ask the AI to run.
- The session token grants full control of your Minehut account. It is stored locally, but treat it like a password.
- Never paste credentials into a shared or public chat.
- Destructive actions (server reset, account deletion) are intentionally not automated by default. Use the browser tools and your own judgement.

## 📄 License

MIT. Not affiliated with Minehut or Mojang.