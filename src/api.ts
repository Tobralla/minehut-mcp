import { effectiveSession } from "./config.js";

const BASE = "https://api.minehut.com";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export interface ServerSummary {
  id: string;
  name: string;
  online: boolean;
  players: number;
  maxPlayers: number;
  ram: number;
  motd: string;
  active_plugins: string[];
  platform: string | null;
  version: string | null;
}

function authHeaders(): Record<string, string> {
  const session = effectiveSession();
  if (!session.token || !session.sessionId) {
    throw new ApiError(
      "No Minehut session found. Log in first: run the browser_login_panel tool (recommended), or set MINEHUT_TOKEN and MINEHUT_SESSION_ID environment variables.",
    );
  }
  return {
    Authorization: session.token,
    "x-session-id": session.sessionId,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(
        "Minehut rejected the session (401/403). The session may have expired. Re-login with browser_login_panel.",
        res.status,
      );
    }
    const body = await res.text().catch(() => "");
    throw new ApiError(
      `Minehut API returned ${res.status} for ${path}. ${body.slice(0, 200)}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

function pickId(nameOrId: string, server?: ServerSummary): string {
  return server?.id ?? nameOrId;
}

export async function fetchUser(): Promise<any> {
  return request<any>("/user");
}

export async function listServers(): Promise<ServerSummary[]> {
  const user = await fetchUser();
  const ids: string[] = user?.servers ?? [];
  if (ids.length === 0) return [];
  const results = await Promise.allSettled(ids.map((id) => fetchServerInfo(id)));
  const out: ServerSummary[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  return out;
}

export async function fetchServerInfo(nameOrId: string): Promise<ServerSummary> {
  const q = nameOrId.length === 24 ? "" : "?byName=true";
  const data = await request<any>(`/server/${encodeURIComponent(nameOrId)}${q}`);
  const s = data?.server;
  if (!s) throw new ApiError(`Server "${nameOrId}" not found on your account.`);
  return {
    id: s._id,
    name: s.name,
    online: !!s.online,
    players: s.playerCount ?? 0,
    maxPlayers: s.maxPlayers ?? 0,
    ram: s.ram ?? 0,
    motd: s.motd ?? "",
    active_plugins: s.active_plugins ?? [],
    platform: s.server_platform ?? null,
    version: s.version ?? null,
  };
}

export async function fetchOnlinePlayers(nameOrId: string, server?: ServerSummary): Promise<string[]> {
  const data = await request<any>(`/server/${pickId(nameOrId, server)}/online`);
  const players = data?.online ?? data?.players ?? [];
  const names = Array.isArray(players)
    ? players.map((p: any) => (typeof p === "string" ? p : p?.name ?? JSON.stringify(p)))
    : [];
  return names;
}

export async function fetchServerLog(nameOrId: string, server?: ServerSummary, lines = 100): Promise<string> {
  const data = await request<any>(`/server/${pickId(nameOrId, server)}/log`);
  const log = data?.log ?? data?.logs ?? "";
  const list = Array.isArray(log) ? log.join("\n") : String(log);
  return list.split("\n").slice(-lines).join("\n");
}

export async function sendCommand(nameOrId: string, command: string, server?: ServerSummary): Promise<any> {
  return request<any>(`/server/${pickId(nameOrId, server)}/send_command`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export async function startServer(nameOrId: string, server?: ServerSummary): Promise<any> {
  return request<any>(`/server/${pickId(nameOrId, server)}/start_service`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function stopServer(nameOrId: string, server?: ServerSummary): Promise<any> {
  return request<any>(`/server/${pickId(nameOrId, server)}/shutdown_service`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function upgradeRam(nameOrId: string, ram: number, server?: ServerSummary): Promise<any> {
  return request<any>(`/server/${pickId(nameOrId, server)}/upgrade`, {
    method: "POST",
    body: JSON.stringify({ ram }),
  });
}

export function summarize(s: ServerSummary): string {
  return JSON.stringify(
    {
      name: s.name,
      id: s.id,
      online: s.online,
      players: `${s.players}/${s.maxPlayers}`,
      ram_gb: s.ram,
      motd: s.motd,
      version: s.version,
      platform: s.platform,
      plugins: s.active_plugins.length,
    },
    null,
    2,
  );
}